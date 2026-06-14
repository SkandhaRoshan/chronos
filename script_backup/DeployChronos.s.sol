// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { ChronosVault } from "../src/ChronosVault.sol";
import { ChronosExecutor } from "../src/ChronosExecutor.sol";
import { FeeManager } from "../src/risk/FeeManager.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployChronos is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Salts for deterministic addresses – change these for mainnet
    bytes32 constant VAULT_SALT = keccak256("Chronos.Vault.v1");
    bytes32 constant EXECUTOR_SALT = keccak256("Chronos.Executor.v1");
    bytes32 constant FEE_MANAGER_SALT = keccak256("Chronos.FeeManager.v1");

    function run() public {
        address deployer = msg.sender;
        console.log("=== Chronos Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast();

        // 1. Deploy FeeManager (no proxy needed, it's simple)
        bytes memory feeManagerCode = type(FeeManager).creationCode;
        bytes memory feeManagerInitCode = abi.encodePacked(feeManagerCode, abi.encode(deployer));
        address feeManager = deployCreate2(FEE_MANAGER_SALT, feeManagerInitCode);
        console.log("FeeManager deployed at:", feeManager);

        // 2. Deploy ChronosVault implementation and proxy
        ChronosVault vaultImpl = new ChronosVault();
        console.log("Vault implementation:", address(vaultImpl));

        bytes memory vaultProxyCreationCode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(address(vaultImpl), abi.encodeCall(ChronosVault.initialize, (deployer)))
        );
        address vaultProxy = deployCreate2(VAULT_SALT, vaultProxyCreationCode);
        console.log("Vault proxy:", vaultProxy);

        // 3. Deploy ChronosExecutor implementation and proxy
        ChronosExecutor executorImpl = new ChronosExecutor();
        console.log("Executor implementation:", address(executorImpl));

        bytes memory executorProxyCreationCode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(address(executorImpl), abi.encodeCall(ChronosExecutor.initialize, (payable(vaultProxy), deployer)))
        );
        address executorProxy = deployCreate2(EXECUTOR_SALT, executorProxyCreationCode);
        console.log("Executor proxy:", executorProxy);

        // 4. Connect vault to executor
        ChronosVault(vaultProxy).setExecutor(executorProxy);
        console.log("Executor set on vault");

        // 5. Optionally set operator on FeeManager (same as executor address)
        FeeManager(feeManager).setOperator(executorProxy);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Vault Proxy:       ", vaultProxy);
        console.log("Executor Proxy:    ", executorProxy);
        console.log("FeeManager:        ", feeManager);
        console.log("Owner:             ", deployer);
        console.log("");
        console.log("Next: set operator on executor (owner only)");
        console.log("    ChronosExecutor(executorProxy).setOperator(agentAddress)");
    }

    function deployCreate2(bytes32 salt, bytes memory bytecode) internal returns (address addr) {
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
    }
}
