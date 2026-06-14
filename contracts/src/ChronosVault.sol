// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";

/// @title ChronosVault – ERC-4626 style yield vault for Robinhood Chain
/// @notice Users deposit native asset (ETH) and receive shares. The vault delegates
///         funds to a manager (executor) for cross‑protocol yield strategies.
contract ChronosVault is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardTransient,
    ERC20PermitUpgradeable
{
    // === Constants ===
    uint256 public constant RATE_DENOMINATOR = 1e9;      // was CONVERSION_RATE_MULTIPLIER
    uint256 public constant FEE_BASE = 100_000;          // was FEE_DIVISOR
    uint256 public constant MAX_FEE_BPS = 10_000;        // was MAX_FEE (10%)

    // === State Variables ===
    uint256 public depositFeeBps;      // was mintFee
    uint256 public withdrawalFeeBps;   // was redeemFee
    uint256 public sharePrice;         // was conversionRate (shares per native token)

    address public executor;           // was manager

    // === Events ===
    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    event FundsDeployed(address indexed to, uint256 amount);
    event FeeStructureChanged(uint256 oldDepositFee, uint256 newDepositFee, uint256 oldWithdrawalFee, uint256 newWithdrawalFee);
    event SharePriceUpdated(uint256 oldPrice, uint256 newPrice);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param initialOwner Owner of the vault (controls fees, executor, upgrades)
    function initialize(address initialOwner) public initializer {
        __ERC20_init("Chronos Vault Share", "CHR");
        __Ownable_init(initialOwner);
        __ERC20Permit_init("Chronos Vault Share");

        depositFeeBps = 1000;       // 1%
        withdrawalFeeBps = 1000;    // 1%
        sharePrice = RATE_DENOMINATOR; // 1:1 initial
    }

    // === Public / External ===

    /// @notice Deposit native asset (ETH) to mint shares
    function deposit() external payable nonReentrant {
        _deposit(msg.sender, msg.value);
    }

    /// @notice Deposit native asset and specify exact share amount
    function depositExact(uint256 shares) external payable nonReentrant {
        uint256 fee = (msg.value * depositFeeBps) / FEE_BASE;
        uint256 valueAfterFee = msg.value - fee;
        require(valueAfterFee > 0, "Deposit amount too low");
        require(
            valueAfterFee == (shares * sharePrice) / RATE_DENOMINATOR,
            "Value does not match requested shares"
        );
        _mint(msg.sender, shares);
    }

    /// @notice Burn shares to redeem native asset
    function redeem(uint256 shares) external nonReentrant {
        _burn(msg.sender, shares);
        uint256 fee = (shares * withdrawalFeeBps) / FEE_BASE;
        uint256 payout = ((shares - fee) * sharePrice) / RATE_DENOMINATOR;
        (bool success, ) = payable(msg.sender).call{ value: payout }("");
        require(success, "Redeem transfer failed");
    }

    /// @notice Set share price (shares per native token)
    function setSharePrice(uint256 newPrice) external onlyOwner {
        uint256 old = sharePrice;
        sharePrice = newPrice;
        emit SharePriceUpdated(old, newPrice);
    }

    /// @notice Set deposit and withdrawal fees (basis points)
    function setFees(uint256 newDepositFee, uint256 newWithdrawalFee) external onlyOwner {
        require(newDepositFee <= MAX_FEE_BPS, "Deposit fee too high");
        require(newWithdrawalFee <= MAX_FEE_BPS, "Withdrawal fee too high");

        uint256 oldDeposit = depositFeeBps;
        uint256 oldWithdrawal = withdrawalFeeBps;
        depositFeeBps = newDepositFee;
        withdrawalFeeBps = newWithdrawalFee;
        emit FeeStructureChanged(oldDeposit, newDepositFee, oldWithdrawal, newWithdrawalFee);
    }

    /// @notice Set the executor address (agent that deploys funds)
    function setExecutor(address newExecutor) external onlyOwner {
        address old = executor;
        executor = newExecutor;
        emit ExecutorUpdated(old, newExecutor);
    }

    /// @notice Withdraw native asset to be used by executor (e.g., to deposit into protocols)
    function deployFunds(address to, uint256 amount) external {
        require(msg.sender == executor, "Only executor");
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = payable(to).call{ value: amount }("");
        require(success, "Deploy transfer failed");
        emit FundsDeployed(to, amount);
    }

    // === View Functions ===

    /// @notice Calculate total native asset needed to mint a given number of shares (including fee)
    function getDepositCost(uint256 shares) external view returns (uint256) {
        uint256 netCost = (shares * sharePrice) / RATE_DENOMINATOR;
        // depositCost - fee = netCost  => depositCost = netCost * FEE_BASE / (FEE_BASE - depositFeeBps)
        return netCost * FEE_BASE / (FEE_BASE - depositFeeBps);
    }

    /// @notice Calculate how many shares a given native amount yields (after fee)
    function getSharesForAmount(uint256 amount) external view returns (uint256) {
        uint256 fee = (amount * depositFeeBps) / FEE_BASE;
        uint256 amountAfterFee = amount - fee;
        return (amountAfterFee * RATE_DENOMINATOR) / sharePrice;
    }

    // === Internal ===
    function _deposit(address to, uint256 amount) internal {
        uint256 fee = (amount * depositFeeBps) / FEE_BASE;
        uint256 valueAfterFee = amount - fee;
        require(valueAfterFee > 0, "Zero value after fee");
        uint256 shares = valueAfterFee * RATE_DENOMINATOR / sharePrice;
        _mint(to, shares);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Accept native asset from executor (return of funds)
    receive() external payable {}

    /// @dev Storage gap for future upgrades
    uint256[50] private __gap;
}