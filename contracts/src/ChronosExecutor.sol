// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ChronosVault } from "./ChronosVault.sol";

// For Uniswap V4 (temporary – will be replaced with protocol adapters)
import { IPoolManager } from "v4-core/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "v4-core/interfaces/callback/IUnlockCallback.sol";
import { PoolKey } from "v4-core/types/PoolKey.sol";
import { Currency, CurrencyLibrary } from "v4-core/types/Currency.sol";
import { BalanceDelta } from "v4-core/types/BalanceDelta.sol";
import { PoolId, PoolIdLibrary } from "v4-core/types/PoolId.sol";
import { StateLibrary } from "v4-core/libraries/StateLibrary.sol";
import { ModifyLiquidityParams } from "v4-core/types/PoolOperation.sol";
import { FullMath } from "v4-core/libraries/FullMath.sol";
import { FixedPoint128 } from "v4-core/libraries/FixedPoint128.sol";

/// @title ChronosExecutor – Agent-controlled deployment and management of funds
/// @notice Only the operator (agent) can call core methods. On the "home chain" (e.g., Robinhood),
///         it can withdraw from the ChronosVault. On any chain, it can manage liquidity positions.
contract ChronosExecutor is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardTransient,
    UUPSUpgradeable,
    IUnlockCallback
{
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // === State ===
    ChronosVault public vault;
    bool public isHomeChain;        // was isVaultChain
    address public operator;

    struct Position {
        address poolManager;
        PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;
        uint256 timestamp;
    }

    mapping(bytes32 => Position) public positions;
    bytes32[] public positionIds;

    // === Events ===
    event VaultWithdrawal(uint256 amount);
    event VaultReturn(uint256 amount);
    event LiquidityAdded(
        bytes32 indexed positionId,
        address indexed poolManager,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    event LiquidityRemoved(bytes32 indexed positionId, uint128 liquidityRemoved, uint256 amount0, uint256 amount1);
    event FundsBridged(address bridge, uint256 destChainId, uint256 amount);
    event FundsReceived(address indexed from, uint256 amount);
    event OperatorChanged(address indexed oldOp, address indexed newOp);

    // === Errors ===
    error NotHomeChain();
    error NotOperatorOrOwner();
    error InsufficientBalance();
    error TransferFailed();
    error SlippageExceeded();
    error InvalidAction();
    error PositionNotFound();

    // === Modifiers ===
    modifier onlyHomeChain() {
        if (!isHomeChain) revert NotHomeChain();
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperatorOrOwner();
        _;
    }

    // === Constructor ===
    constructor() {
        _disableInitializers();
    }

    /// @param _vault Address of ChronosVault (address(0) if not home chain)
    /// @param initialOwner Owner address (shared across chains)
    function initialize(address payable _vault, address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        vault = ChronosVault(_vault);
        isHomeChain = _vault != address(0);
    }

    // === Vault Interaction (home chain only) ===
    function withdrawFromVault(uint256 amount) external onlyOperatorOrOwner onlyHomeChain nonReentrant {
        vault.deployFunds(address(this), amount);
        emit VaultWithdrawal(amount);
    }

    function returnToVault(uint256 amount) external onlyOperatorOrOwner onlyHomeChain nonReentrant {
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = payable(address(vault)).call{ value: amount }("");
        if (!success) revert TransferFailed();
        emit VaultReturn(amount);
    }

    // === Liquidity Management (Uniswap V4 – will be generalized) ===
    enum CallbackAction { ADD, REMOVE }

    struct AddCallbackData {
        PoolKey key;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
    }

    struct RemoveCallbackData {
        PoolKey key;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        bytes32 salt;
    }

    struct CallbackData {
        CallbackAction action;
        bytes data;
    }

    bytes32 private constant _ACTIVE_PM_SLOT = 0x7e4c2a8d5b3f1e6a9c0d8b7f4e2a1d3c5b8f7e6a9d0c3b2a1f4e8d7c6b5a4e03;

    function _setActivePoolManager(address pm) private {
        assembly { tstore(_ACTIVE_PM_SLOT, pm) }
    }

    function _getActivePoolManager() private view returns (address pm) {
        assembly { pm := tload(_ACTIVE_PM_SLOT) }
    }

    function addLiquidity(
        address poolManagerAddress,
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external onlyOperatorOrOwner nonReentrant returns (uint128 liquidityAdded, uint256 amount0, uint256 amount1) {
        if (!poolKey.currency0.isAddressZero()) {
            IERC20(Currency.unwrap(poolKey.currency0)).safeIncreaseAllowance(poolManagerAddress, amount0Desired);
        }
        if (!poolKey.currency1.isAddressZero()) {
            IERC20(Currency.unwrap(poolKey.currency1)).safeIncreaseAllowance(poolManagerAddress, amount1Desired);
        }

        (liquidityAdded, amount0, amount1) = _addLiquidityToPool(
            poolManagerAddress, poolKey, tickLower, tickUpper, amount0Desired, amount1Desired
        );

        if (amount0 < amount0Min || amount1 < amount1Min) revert SlippageExceeded();

        _storePosition(poolManagerAddress, poolKey, tickLower, tickUpper, liquidityAdded, amount0, amount1);
    }

    function _addLiquidityToPool(
        address poolManagerAddress,
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) internal returns (uint128 liquidityAdded, uint256 amount0, uint256 amount1) {
        CallbackData memory cbData = CallbackData({
            action: CallbackAction.ADD,
            data: abi.encode(
                AddCallbackData({
                    key: poolKey,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired
                })
            )
        });

        _setActivePoolManager(poolManagerAddress);
        bytes memory result = IPoolManager(poolManagerAddress).unlock(abi.encode(cbData));
        (liquidityAdded, amount0, amount1) = abi.decode(result, (uint128, uint256, uint256));
    }

    function _storePosition(
        address poolManagerAddress,
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidityAdded,
        uint256 amount0,
        uint256 amount1
    ) internal {
        bytes32 positionId = keccak256(
            abi.encodePacked(poolKey.toId(), address(this), tickLower, tickUpper, bytes32(0))
        );

        if (positions[positionId].timestamp == 0) {
            positions[positionId] = Position({
                poolManager: poolManagerAddress,
                poolKey: poolKey,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidity: liquidityAdded,
                amount0: amount0,
                amount1: amount1,
                timestamp: block.timestamp
            });
            positionIds.push(positionId);
        } else {
            positions[positionId].liquidity += liquidityAdded;
            positions[positionId].amount0 += amount0;
            positions[positionId].amount1 += amount1;
        }

        emit LiquidityAdded(positionId, poolManagerAddress, tickLower, tickUpper, liquidityAdded, amount0, amount1);
    }

    function removeLiquidity(
        address poolManagerAddress,
        PoolKey calldata poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) external onlyOperatorOrOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        bytes32 positionId = keccak256(
            abi.encodePacked(poolKey.toId(), address(this), tickLower, tickUpper, bytes32(0))
        );

        if (positions[positionId].timestamp == 0) revert PositionNotFound();

        IPoolManager poolManager = IPoolManager(poolManagerAddress);

        CallbackData memory cbData = CallbackData({
            action: CallbackAction.REMOVE,
            data: abi.encode(
                RemoveCallbackData({
                    key: poolKey,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidity: liquidity,
                    salt: bytes32(0)
                })
            )
        });

        _setActivePoolManager(poolManagerAddress);
        bytes memory result = poolManager.unlock(abi.encode(cbData));
        (amount0, amount1) = abi.decode(result, (uint256, uint256));

        if (amount0 < amount0Min || amount1 < amount1Min) revert SlippageExceeded();

        if (positions[positionId].liquidity >= liquidity) {
            positions[positionId].liquidity -= liquidity;
            if (positions[positionId].liquidity == 0) {
                _removePosition(positionId);
            }
        }

        emit LiquidityRemoved(positionId, liquidity, amount0, amount1);
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != _getActivePoolManager()) revert InvalidAction();

        CallbackData memory data = abi.decode(rawData, (CallbackData));

        if (data.action == CallbackAction.ADD) {
            return _handleAdd(IPoolManager(msg.sender), data.data);
        } else if (data.action == CallbackAction.REMOVE) {
            return _handleRemove(IPoolManager(msg.sender), data.data);
        } else {
            revert InvalidAction();
        }
    }

    function _handleAdd(IPoolManager poolManager, bytes memory data) internal returns (bytes memory) {
        AddCallbackData memory addData = abi.decode(data, (AddCallbackData));

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(addData.key.toId());

        uint128 liquidity = _getLiquidityForAmounts(
            sqrtPriceX96, addData.tickLower, addData.tickUpper, addData.amount0Desired, addData.amount1Desired
        );

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            addData.key,
            ModifyLiquidityParams({
                tickLower: addData.tickLower,
                tickUpper: addData.tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            }),
            ""
        );

        int128 delta0 = delta.amount0();
        int128 delta1 = delta.amount1();

        uint256 amount0Used = 0;
        uint256 amount1Used = 0;

        if (delta0 < 0) {
            amount0Used = uint128(-delta0);
            _settle(poolManager, addData.key.currency0, amount0Used);
        }
        if (delta1 < 0) {
            amount1Used = uint128(-delta1);
            _settle(poolManager, addData.key.currency1, amount1Used);
        }

        return abi.encode(liquidity, amount0Used, amount1Used);
    }

    function _handleRemove(IPoolManager poolManager, bytes memory data) internal returns (bytes memory) {
        RemoveCallbackData memory removeData = abi.decode(data, (RemoveCallbackData));

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            removeData.key,
            ModifyLiquidityParams({
                tickLower: removeData.tickLower,
                tickUpper: removeData.tickUpper,
                liquidityDelta: -int256(uint256(removeData.liquidity)),
                salt: removeData.salt
            }),
            ""
        );

        int128 delta0 = delta.amount0();
        int128 delta1 = delta.amount1();

        uint256 amount0Received = 0;
        uint256 amount1Received = 0;

        if (delta0 > 0) {
            amount0Received = uint128(delta0);
            poolManager.take(removeData.key.currency0, address(this), amount0Received);
        }
        if (delta1 > 0) {
            amount1Received = uint128(delta1);
            poolManager.take(removeData.key.currency1, address(this), amount1Received);
        }

        return abi.encode(amount0Received, amount1Received);
    }

    function _settle(IPoolManager poolManager, Currency currency, uint256 amount) internal {
        if (currency.isAddressZero()) {
            poolManager.settle{ value: amount }();
        } else {
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), amount);
            poolManager.settle();
        }
    }

    function _getLiquidityForAmounts(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128) {
        // Simplified version – in production use UniswapV4Math library.
        // For now, we return a placeholder. Real implementation will be added later.
        return uint128((amount0 + amount1) / 2);
    }

    function _removePosition(bytes32 positionId) internal {
        delete positions[positionId];
        for (uint256 i = 0; i < positionIds.length; i++) {
            if (positionIds[i] == positionId) {
                positionIds[i] = positionIds[positionIds.length - 1];
                positionIds.pop();
                break;
            }
        }
    }

    // === Bridge (generic) ===
    function bridgeFunds(address bridge, uint256 destChainId, uint256 amount, bytes calldata callData)
        external
        onlyOperatorOrOwner
        nonReentrant
    {
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = bridge.call{ value: amount }(callData);
        if (!success) revert TransferFailed();
        emit FundsBridged(bridge, destChainId, amount);
    }

    function bridgeTokens(address bridge, address token, uint256 destChainId, uint256 amount, bytes calldata callData)
        external
        onlyOperatorOrOwner
        nonReentrant
    {
        IERC20(token).safeIncreaseAllowance(bridge, amount);
        (bool success, ) = bridge.call(callData);
        if (!success) revert TransferFailed();
        emit FundsBridged(bridge, destChainId, amount);
    }

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    // === Admin ===
    function setOperator(address newOperator) external onlyOwner {
        address old = operator;
        operator = newOperator;
        emit OperatorChanged(old, newOperator);
    }

    function emergencyWithdrawETH(address payable to, uint256 amount) external onlyOwner {
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = to.call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    function emergencyWithdrawToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}