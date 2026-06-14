// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { ChronosVault } from "../src/ChronosVault.sol";
import { ChronosExecutor } from "../src/ChronosExecutor.sol";
import { ChronosAgentDirectory } from "../src/ChronosAgentDirectory.sol";
import { ChronosFirewall } from "../src/ChronosFirewall.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployChronos
 * @dev High-fidelity upgradeable foundry deployment script for Chronos DeFi infrastructure.
 */
contract DeployChronos is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("OPERATOR_PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log(unicode"──────────────────────────────────────────────────");
        console.log(unicode"🚀 INITIALIZING UPGRADEABLE DEPLOYMENT PIPELINE");
        console.log("Deployer Wallet Identity Address:", deployerAddress);
        console.log(unicode"──────────────────────────────────────────────────");

        vm.startBroadcast(deployerPrivateKey);

        ChronosAgentDirectory directoryImpl = new ChronosAgentDirectory();
        console.log("ChronosAgentDirectory Implementation Deployed at:", address(directoryImpl));

        ChronosVault vaultImpl = new ChronosVault();
        console.log("ChronosVault Implementation Deployed at:", address(vaultImpl));

        bytes memory vaultInitData = abi.encodeWithSelector(
            ChronosVault.initialize.selector,
            deployerAddress
        );
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), vaultInitData);
        ChronosVault functionalVault = ChronosVault(payable(address(vaultProxy)));
        console.log(unicode"🚀 CHRONOS_VAULT_PROXY Address:", address(functionalVault));

        ChronosExecutor executorImpl = new ChronosExecutor();
        console.log("ChronosExecutor Implementation Deployed at:", address(executorImpl));

        bytes memory executorInitData = abi.encodeWithSelector(
            ChronosExecutor.initialize.selector,
            payable(address(functionalVault)),
            deployerAddress
        );
        ERC1967Proxy executorProxy = new ERC1967Proxy(address(executorImpl), executorInitData);
        
        ChronosExecutor functionalExecutor = ChronosExecutor(payable(address(executorProxy)));
        console.log(unicode"🚀 CHRONOS_EXECUTOR_PROXY Address:", address(functionalExecutor));

        functionalVault.setExecutor(address(functionalExecutor));
        console.log(unicode"✅ State alignment complete! Vault proxy authorized to Executor proxy.");

        address activeSafeContext = vm.envOr("SIMPLE_VAULT_ADDRESS", address(functionalVault));
        ChronosFirewall firewall = new ChronosFirewall(activeSafeContext, deployerAddress);
        console.log("ChronosFirewall Safe Guard Deployed at:", address(firewall));

        vm.stopBroadcast();
        console.log(unicode"──────────────────────────────────────────────────");
        console.log(unicode"✅ UPGRADEABLE DEPLOYMENT RECONCILIATION COMPLETE");
        console.log(unicode"──────────────────────────────────────────────────");
    }
}
