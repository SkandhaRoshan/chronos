// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ChronosVault } from "./ChronosVault.sol";

/**
 * @title ChronosExecutor
 * @dev Secure automated transaction script execution hub for AI agent swarms.
 */
contract ChronosExecutor is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    ChronosVault public vault;
    address public operator;
    bool public isHomeChain;

    struct Position {
        bytes32 id;
        address poolManager;
        address token0;
        address token1;
        uint128 liquidity;
        uint256 amount0;
        uint256 amount1;
        uint256 timestamp;
    }

    mapping(bytes32 => Position) private _positions;
    bytes32[] private _positionIds;

    event VaultWithdrawal(uint256 amount);
    event VaultReturn(uint256 amount);
    event LiquidityAdded(bytes32 indexed positionId, address indexed poolManager, uint128 liquidity, uint256 amount0, uint256 amount1);
    event LiquidityRemoved(bytes32 indexed positionId, uint128 liquidityRemoved, uint256 amount0, uint256 amount1);
    event FundsBridged(address indexed bridge, uint256 indexed destChainId, uint256 amount);
    event FundsReceived(address indexed from, uint256 amount);
    event OperatorChanged(address indexed oldOp, address indexed newOp);

    error NotHomeChain();
    error NotOperatorOrOwner();
    error InsufficientBalance();
    error TransferFailed();
    error ZeroAddressDetected();
    error SlippageExceeded();
    error PositionNotFound();

    modifier onlyHomeChain() {
        if (!isHomeChain) revert NotHomeChain();
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperatorOrOwner();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address payable _vault, address initialOwner) public initializer {
        if (initialOwner == address(0)) revert ZeroAddressDetected();
        __Ownable_init(initialOwner);
        // FIXED: Removed the redundant __UUPSUpgradeable_init() statement block

        vault = ChronosVault(_vault);
        isHomeChain = _vault != address(0);
    }

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

    function addLiquidity(
        address poolManagerAddress,
        address token0,
        address address1,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external onlyOperatorOrOwner nonReentrant returns (bytes32 positionId, uint128 liquidityAdded) {
        if (poolManagerAddress == address(0) || token0 == address(0) || address1 == address(0)) revert ZeroAddressDetected();
        if (amount0Desired == 0 && amount1Desired == 0) revert SlippageExceeded();

        if (token0 != address(0)) IERC20(token0).safeIncreaseAllowance(poolManagerAddress, amount0Desired);
        if (address1 != address(0)) IERC20(address1).safeIncreaseAllowance(poolManagerAddress, amount1Desired);

        positionId = keccak256(abi.encodePacked(poolManagerAddress, token0, address1, block.timestamp));
        liquidityAdded = uint128((amount0Desired + amount1Desired) / 2);

        _positions[positionId] = Position({
            id: positionId,
            poolManager: poolManagerAddress,
            token0: token0,
            token1: address1,
            liquidity: liquidityAdded,
            amount0: amount0Desired,
            amount1: amount1Desired,
            timestamp: block.timestamp
        });

        _positionIds.push(positionId);
        emit LiquidityAdded(positionId, poolManagerAddress, liquidityAdded, amount0Desired, amount1Desired);
        
        if (amount0Desired < amount0Min || amount1Desired < amount1Min) revert SlippageExceeded();
    }

    function removeLiquidity(
        bytes32 positionId,
        uint128 liquidity,
        uint256 amount0Min,
        uint256 amount1Min
    ) external onlyOperatorOrOwner nonReentrant returns (uint256 amount0, uint256 amount1) {
        Position storage pos = _positions[positionId];
        if (pos.timestamp == 0) revert PositionNotFound();
        if (pos.liquidity < liquidity) revert SlippageExceeded();

        amount0 = (pos.amount0 * liquidity) / pos.liquidity;
        amount1 = (pos.amount1 * liquidity) / pos.liquidity;

        if (amount0 < amount0Min || amount1 < amount1Min) revert SlippageExceeded();

        pos.liquidity -= liquidity;
        pos.amount0 -= amount0;
        pos.amount1 -= amount1;

        if (pos.liquidity == 0) {
            _removePosition(positionId);
        }

        emit LiquidityRemoved(positionId, liquidity, amount0, amount1);
    }

    function bridgeFunds(address bridge, uint256 destChainId, uint256 amount, bytes calldata callData) external onlyOperatorOrOwner nonReentrant {
        if (bridge == address(0)) revert ZeroAddressDetected();
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = bridge.call{ value: amount }(callData);
        if (!success) revert TransferFailed();
        emit FundsBridged(bridge, destChainId, amount);
    }

    function bridgeTokens(address bridge, address token, uint256 destChainId, uint256 amount, bytes calldata callData) external onlyOperatorOrOwner nonReentrant {
        if (bridge == address(0) || token == address(0)) revert ZeroAddressDetected();
        IERC20(token).safeIncreaseAllowance(bridge, amount);
        (bool success, ) = bridge.call(callData);
        if (!success) revert TransferFailed();
        emit FundsBridged(bridge, destChainId, amount);
    }

    function getPosition(bytes32 id) external view returns (Position memory) {
        Position memory pos = _positions[id];
        if (pos.timestamp == 0) revert PositionNotFound();
        return pos;
    }

    function getPositionCount() external view returns (uint256) {
        return _positionIds.length;
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddressDetected();
        address old = operator;
        operator = newOperator;
        emit OperatorChanged(old, newOperator);
    }

    function emergencyWithdrawETH(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddressDetected();
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool success, ) = to.call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    function emergencyWithdrawToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0) || token == address(0)) revert ZeroAddressDetected();
        IERC20(token).safeTransfer(to, amount);
    }

    function _removePosition(bytes32 positionId) internal {
        delete _positions[positionId];
        uint256 len = _positionIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (_positionIds[i] == positionId) {
                _positionIds[i] = _positionIds[len - 1];
                _positionIds.pop();
                break;
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}
