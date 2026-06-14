// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ProtocolMath
 * @dev High-performance, self-contained mathematical library for fee scaling, drift, and yield calculations.
 * Completely optimized to remove fragile external testing dependencies and ensure 100% compiler stability.
 */
library ProtocolMath {
    uint256 public constant RAY = 1e27;
    uint256 public constant WAD = 1e18;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /**
     * @dev Multiplies two values scaled by WAD (18 decimals) with rounding optimization.
     */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0 || b == 0) return 0;
        c = (a * b + WAD / 2) / WAD;
    }

    /**
     * @dev Divides two values scaled by WAD (18 decimals) with rounding optimization.
     */
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256 c) {
        require(b > 0, "Zero division constraint");
        c = (a * WAD + b / 2) / b;
    }

    /**
     * @dev Multiplies two values scaled by RAY (27 decimals) - optimized for Aave dynamic APY tracking.
     */
    function rayMul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0 || b == 0) return 0;
        c = (a * b + RAY / 2) / RAY;
    }

    /**
     * @dev Divides two values scaled by RAY (27 decimals) - optimized for Aave dynamic APY tracking.
     */
    function rayDiv(uint256 a, uint256 b) internal pure returns (uint256 c) {
        require(b > 0, "Zero division constraint");
        c = (a * RAY + b / 2) / b;
    }

    /**
     * @dev Calculates percentage allocations or drift deviations using basic Basis Points (bps).
     */
    function calculateBps(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / BPS_DENOMINATOR;
    }

    /**
     * @dev Validates if portfolio reallocation drift stays within the safe firewall boundary percentage bands.
     */
    function isDriftSafe(uint256 currentPct, uint256 targetPct, uint256 maxDriftBps) internal pure returns (bool) {
        uint256 drift = currentPct >= targetPct ? currentPct - targetPct : targetPct - currentPct;
        return drift <= maxDriftBps;
    }
}
