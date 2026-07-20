// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockUSDC mockUSDC = new MockUSDC();

        vm.stopBroadcast();

        console.log("=== Mock USDC Deployed ===");
        console.log("Address:", address(mockUSDC));
        console.log("==========================");
    }
}
