// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {FundraisingPool} from "../src/FundraisingPool.sol";

contract DeployFundraisingPool is Script {
    function run() external returns (FundraisingPool pool) {
        vm.startBroadcast();
        pool = new FundraisingPool(msg.sender);
        vm.stopBroadcast();
    }
}
