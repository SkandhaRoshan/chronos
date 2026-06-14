// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";

/**
 * @title ChronosVault
 * @dev Secure ERC20 yield vault structure.
 */
contract ChronosVault is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    ERC20PermitUpgradeable
{
    uint256 public constant RATE_DENOMINATOR = 1e9;
    uint256 public constant FEE_BASE = 100_000;
    uint256 public constant MAX_FEE_BPS = 10_000;

    uint256 public depositFeeBps;
    uint256 public withdrawalFeeBps;
    uint256 public sharePrice;
    address public executor;

    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    event FundsDeployed(address indexed to, uint256 amount);
    event FeeStructureChanged(uint256 oldDepositFee, uint256 newDepositFee, uint256 oldWithdrawalFee, uint256 newWithdrawalFee);
    event SharePriceUpdated(uint256 oldPrice, uint256 newPrice);

    error FeeTooHigh();
    error OnlyExecutor();
    error InsufficientBalance();
    error TransferFailed();
    error ValueMismatch();
    error DepositTooLow();
    error ZeroAddressDetected();

    modifier onlyExecutor() {
        if (msg.sender != executor) revert OnlyExecutor();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        if (initialOwner == address(0)) revert ZeroAddressDetected();
        __ERC20_init("Chronos Vault Share", "CHR");
        __Ownable_init(initialOwner);
        __ERC20Permit_init("Chronos Vault Share");
        // FIXED: Removed the redundant un-declared __UUPSUpgradeable_init() tracker block

        depositFeeBps = 1000;
        withdrawalFeeBps = 1000;
        sharePrice = RATE_DENOMINATOR;
    }

    function deposit() external payable nonReentrant {
        _deposit(msg.sender, msg.value);
    }

    function depositExact(uint256 shares) external payable nonReentrant {
        uint256 fee = (msg.value * depositFeeBps) / FEE_BASE;
        uint256 valueAfterFee = msg.value - fee;
        if (valueAfterFee == 0) revert DepositTooLow();
        if (valueAfterFee != (shares * sharePrice) / RATE_DENOMINATOR) revert ValueMismatch();
        
        _mint(msg.sender, shares);
    }

    function redeem(uint256 shares) external nonReentrant {
        _burn(msg.sender, shares);
        uint256 fee = (shares * withdrawalFeeBps) / FEE_BASE;
        uint256 payout = ((shares - fee) * sharePrice) / RATE_DENOMINATOR;
        
        (bool success, ) = payable(msg.sender).call{ value: payout }("");
        if (!success) revert TransferFailed();
    }

    function setSharePrice(uint256 newPrice) external onlyOwner {
        uint256 old = sharePrice;
        sharePrice = newPrice;
        emit SharePriceUpdated(old, newPrice);
    }

    function setFees(uint256 newDepositFee, uint256 newWithdrawalFee) external onlyOwner {
        if (newDepositFee > MAX_FEE_BPS || newWithdrawalFee > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldDeposit = depositFeeBps;
        uint256 oldWithdrawal = withdrawalFeeBps;
        
        depositFeeBps = newDepositFee;
        withdrawalFeeBps = newWithdrawalFee;
        emit FeeStructureChanged(oldDeposit, newDepositFee, oldWithdrawal, newWithdrawalFee);
    }

    function setExecutor(address newExecutor) external onlyOwner {
        if (newExecutor == address(0)) revert ZeroAddressDetected();
        address old = executor;
        executor = newExecutor;
        emit ExecutorUpdated(old, newExecutor);
    }

    function deployFunds(address to, uint256 amount) external onlyExecutor {
        if (to == address(0)) revert ZeroAddressDetected();
        if (address(this).balance < amount) revert InsufficientBalance();
        
        (bool success, ) = payable(to).call{ value: amount }("");
        if (!success) revert TransferFailed();
        emit FundsDeployed(to, amount);
    }

    function getDepositCost(uint256 shares) external view returns (uint256) {
        uint256 netCost = (shares * sharePrice) / RATE_DENOMINATOR;
        return (netCost * FEE_BASE) / (FEE_BASE - depositFeeBps);
    }

    function getSharesForAmount(uint256 amount) external view returns (uint256) {
        uint256 fee = (amount * depositFeeBps) / FEE_BASE;
        uint256 amountAfterFee = amount - fee;
        return (amountAfterFee * RATE_DENOMINATOR) / sharePrice;
    }

    function _deposit(address to, uint256 amount) internal {
        uint256 fee = (amount * depositFeeBps) / FEE_BASE;
        uint256 valueAfterFee = amount - fee;
        if (valueAfterFee == 0) revert DepositTooLow();
        
        uint256 shares = (valueAfterFee * RATE_DENOMINATOR) / sharePrice;
        _mint(to, shares);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
