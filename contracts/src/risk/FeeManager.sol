// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title FeeManager – dynamic fee oracle for Chronos
/// @notice Stores and adjusts fee parameters based on market volatility (set by agent)
///         This replaces the Uniswap V4 hook pattern with a standalone contract.
contract FeeManager is Ownable {
    // Fee units: hundredths of a bip (1e-6 of 1%)
    uint24 public constant DEFAULT_FEE = 490;    // 0.049%
    uint24 public constant MIN_FEE_BOUND = 50;   // 0.005%
    uint24 public constant MAX_FEE_CAP = 1_000_000; // 100%

    uint24 public minFee = MIN_FEE_BOUND;
    uint24 public maxFee = 10_000;   // 1% cap by default
    uint24 public protocolFee = 10;   // 0.001% of swap output

    address public operator;

    // Mapping from strategy ID (or pool ID) to target fee
    mapping(bytes32 => uint24) public targetFees;

    event TargetFeeSet(bytes32 indexed identifier, uint24 fee);
    event BoundsUpdated(uint24 minFee, uint24 maxFee);
    event ProtocolFeeUpdated(uint24 fee);
    event OperatorChanged(address indexed oldOperator, address indexed newOperator);

    error FeeTooLow(uint24 fee, uint24 minimum);
    error FeeTooHigh(uint24 fee, uint24 maximum);
    error InvalidBounds();
    error NotOperatorOrOwner();

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperatorOrOwner();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Set target fee for a specific strategy/pool
    function setTargetFee(bytes32 identifier, uint24 fee) external onlyOperatorOrOwner {
        if (fee < minFee) revert FeeTooLow(fee, minFee);
        if (fee > maxFee) revert FeeTooHigh(fee, maxFee);
        targetFees[identifier] = fee;
        emit TargetFeeSet(identifier, fee);
    }

    /// @notice Get the effective fee for a strategy (returns default if not set)
    function getEffectiveFee(bytes32 identifier) external view returns (uint24) {
        uint24 fee = targetFees[identifier];
        return fee == 0 ? DEFAULT_FEE : fee;
    }

    /// @notice Update global fee bounds
    function setBounds(uint24 _minFee, uint24 _maxFee) external onlyOwner {
        if (_minFee > _maxFee || _maxFee > MAX_FEE_CAP) revert InvalidBounds();
        minFee = _minFee;
        maxFee = _maxFee;
        emit BoundsUpdated(_minFee, _maxFee);
    }

    /// @notice Update protocol fee (basis points)
    function setProtocolFee(uint24 _fee) external onlyOwner {
        if (_fee > MAX_FEE_CAP) revert FeeTooHigh(_fee, uint24(MAX_FEE_CAP));
        protocolFee = _fee;
        emit ProtocolFeeUpdated(_fee);
    }

    /// @notice Set operator address (the off-chain agent)
    function setOperator(address newOperator) external onlyOwner {
        address old = operator;
        operator = newOperator;
        emit OperatorChanged(old, newOperator);
    }
}
