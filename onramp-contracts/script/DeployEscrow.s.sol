// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {EscrowMaster} from "../src/EscrowMaster.sol";

/// @title DeployEscrow — Deploy script for EscrowMaster on Polygon
/// @notice Deploys the EscrowMaster contract with configured roles
/// @dev Usage:
///   Testnet: forge script script/DeployEscrow.s.sol --rpc-url amoy --broadcast --verify
///   Mainnet: forge script script/DeployEscrow.s.sol --rpc-url polygon --broadcast --verify
contract DeployEscrow is Script {
    function run() public {
        // Load deployer private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Configuration — EDIT THESE FOR EACH NETWORK
        // Polygon Amoy testnet USDC: 0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582
        // Polygon mainnet USDC: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
        address stablecoinAddress = vm.envAddress("STABLECOIN_ADDRESS");
        address treasuryAddress = vm.envAddress("TREASURY_ADDRESS");
        address operatorAddress = vm.envAddress("OPERATOR_ADDRESS");
        address arbiterAddress = vm.envAddress("ARBITER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        EscrowMaster escrow = new EscrowMaster(
            stablecoinAddress,
            treasuryAddress,
            operatorAddress,
            arbiterAddress
        );

        vm.stopBroadcast();

        // Log deployment info
        console.log("=== EscrowMaster Deployed ===");
        console.log("Contract address:", address(escrow));
        console.log("Stablecoin:", stablecoinAddress);
        console.log("Treasury:", treasuryAddress);
        console.log("Operator:", operatorAddress);
        console.log("Arbiter:", arbiterAddress);
        console.log("Deployer (DEFAULT_ADMIN + LP_ADMIN):", msg.sender);
        console.log("=============================");
    }
}
