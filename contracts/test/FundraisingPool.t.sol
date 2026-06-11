// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FundraisingPool} from "../src/FundraisingPool.sol";

contract FundraisingPoolTest is Test {
    FundraisingPool private pool;

    address private admin = address(0xA11CE);
    address private alice = address(0xA11CE1);
    address private bob = address(0xB0B);
    address private carol = address(0xCAFE);
    address private attacker = address(0xBAD);

    function setUp() public {
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(attacker, 100 ether);
        vm.deal(admin, 100 ether);

        pool = new FundraisingPool(admin);
    }

    // ---------------------------------------------------------------
    // Deposit & Mint
    // ---------------------------------------------------------------

    function testDepositMintsTokensOneToOne() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        assertEq(pool.balanceOf(alice), 5 ether);
        assertEq(pool.totalSupply(), 5 ether);
    }

    function testDepositMultipleAccounts() public {
        vm.prank(alice);
        pool.deposit{value: 3 ether}();
        vm.prank(bob);
        pool.deposit{value: 7 ether}();

        assertEq(pool.balanceOf(alice), 3 ether);
        assertEq(pool.balanceOf(bob), 7 ether);
        assertEq(pool.totalSupply(), 10 ether);
    }

    function testDepositZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(FundraisingPool.InvalidAmount.selector);
        pool.deposit{value: 0}();
    }

    function testDepositEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit FundraisingPool.Deposited(alice, 2 ether);
        pool.deposit{value: 2 ether}();
    }

    // ---------------------------------------------------------------
    // Burn & Withdraw
    // ---------------------------------------------------------------

    function testWithdrawBurnsTokensAndReturnsETH() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        pool.withdraw(3 ether);

        assertEq(pool.balanceOf(alice), 2 ether);
        assertEq(pool.totalSupply(), 2 ether);
        assertEq(alice.balance, balanceBefore + 3 ether);
    }

    function testWithdrawZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(FundraisingPool.InvalidAmount.selector);
        pool.withdraw(0);
    }

    function testWithdrawMoreThanBalanceReverts() public {
        vm.prank(alice);
        pool.deposit{value: 2 ether}();

        vm.prank(alice);
        vm.expectRevert();
        pool.withdraw(3 ether);
    }

    function testWithdrawEmitsEvent() public {
        vm.prank(alice);
        pool.deposit{value: 2 ether}();

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit FundraisingPool.Withdrawn(alice, 2 ether);
        pool.withdraw(2 ether);
    }

    // ---------------------------------------------------------------
    // Dividend Distribution — O(1) per-share accumulator
    // ---------------------------------------------------------------

    function testDistributeDividendsSingleHolder() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 1 ether}();

        assertApproxEqAbs(pool.withdrawableDividendOf(alice), 1 ether, 2);
        assertEq(pool.totalDividendsDistributed(), 1 ether);
    }

    function testDistributeDividendsProportional() public {
        vm.prank(alice);
        pool.deposit{value: 3 ether}(); // 30%
        vm.prank(bob);
        pool.deposit{value: 7 ether}(); // 70%

        vm.prank(admin);
        pool.distributeDividends{value: 10 ether}();

        assertEq(pool.withdrawableDividendOf(alice), 3 ether);
        assertEq(pool.withdrawableDividendOf(bob), 7 ether);
    }

    function testDistributeDividendsThreeHolders() public {
        vm.prank(alice);
        pool.deposit{value: 2 ether}(); // 20%
        vm.prank(bob);
        pool.deposit{value: 3 ether}(); // 30%
        vm.prank(carol);
        pool.deposit{value: 5 ether}(); // 50%

        vm.prank(admin);
        pool.distributeDividends{value: 100 ether}();

        assertEq(pool.withdrawableDividendOf(alice), 20 ether);
        assertEq(pool.withdrawableDividendOf(bob), 30 ether);
        assertEq(pool.withdrawableDividendOf(carol), 50 ether);
    }

    function testDistributeDividendsZeroSupplyReverts() public {
        vm.prank(admin);
        vm.expectRevert(FundraisingPool.NoHolders.selector);
        pool.distributeDividends{value: 1 ether}();
    }

    function testDistributeDividendsZeroAmountReverts() public {
        vm.prank(alice);
        pool.deposit{value: 1 ether}();

        vm.prank(admin);
        vm.expectRevert(FundraisingPool.InvalidAmount.selector);
        pool.distributeDividends{value: 0}();
    }

    function testDistributeDividendsUnauthorizedReverts() public {
        vm.prank(alice);
        pool.deposit{value: 1 ether}();

        vm.prank(attacker);
        vm.expectRevert();
        pool.distributeDividends{value: 1 ether}();
    }

    function testDistributeDividendsEmitsEvent() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit FundraisingPool.DividendsDistributed(admin, 1 ether, 10 ether);
        pool.distributeDividends{value: 1 ether}();
    }

    // ---------------------------------------------------------------
    // Claim Dividends
    // ---------------------------------------------------------------

    function testClaimDividendTransfersETH() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 2 ether}();

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        pool.claimDividend();

        assertApproxEqAbs(alice.balance, balanceBefore + 2 ether, 2);
        assertEq(pool.withdrawableDividendOf(alice), 0);
    }

    function testClaimDividendEmitsEvent() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 1 ether}();

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit FundraisingPool.DividendClaimed(alice, 0); // amount not checked
        pool.claimDividend();
    }

    function testClaimDividendNothingReverts() public {
        vm.prank(alice);
        pool.deposit{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert(FundraisingPool.NoDividendsToClaim.selector);
        pool.claimDividend();
    }

    function testClaimDividendTwiceDoesNotDoubleSpend() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 1 ether}();

        vm.prank(alice);
        pool.claimDividend();

        vm.prank(alice);
        vm.expectRevert(FundraisingPool.NoDividendsToClaim.selector);
        pool.claimDividend();
    }

    // ---------------------------------------------------------------
    // Multiple Distribution Rounds
    // ---------------------------------------------------------------

    function testMultipleDistributionRoundsAccumulate() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();
        vm.prank(bob);
        pool.deposit{value: 5 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 2 ether}();

        assertApproxEqAbs(pool.withdrawableDividendOf(alice), 1 ether, 2);
        assertApproxEqAbs(pool.withdrawableDividendOf(bob), 1 ether, 2);

        vm.prank(admin);
        pool.distributeDividends{value: 4 ether}();

        assertApproxEqAbs(pool.withdrawableDividendOf(alice), 3 ether, 2);
        assertApproxEqAbs(pool.withdrawableDividendOf(bob), 3 ether, 2);
        assertEq(pool.totalDividendsDistributed(), 6 ether);
    }

    // ---------------------------------------------------------------
    // Dividends Stay with Original Holder After Transfer
    // ---------------------------------------------------------------

    function testDividendsAccruedBeforeTransferStayWithOriginalHolder() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 2 ether}();

        // Alice transfers all tokens to Bob AFTER distribution
        vm.prank(alice);
        pool.transfer(bob, 10 ether);

        // Alice can still claim dividends accrued before transfer
        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        pool.claimDividend();
        assertApproxEqAbs(alice.balance, balanceBefore + 2 ether, 2);

        // Bob has tokens now but no dividends accrued before the transfer
        assertEq(pool.withdrawableDividendOf(bob), 0);
    }

    // ---------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------

    function testETHBalanceMatchesTotalSupply() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();
        vm.prank(bob);
        pool.deposit{value: 5 ether}();

        assertEq(address(pool).balance, 15 ether);

        vm.prank(alice);
        pool.withdraw(4 ether);
        assertEq(pool.totalSupply(), 11 ether);
        assertEq(address(pool).balance, 11 ether);
    }

    function testCannotWithdrawFromEmptyAccount() public {
        vm.prank(alice);
        vm.expectRevert();
        pool.withdraw(1 ether);
    }

    // ---------------------------------------------------------------
    // Reentrancy
    // ---------------------------------------------------------------

    function testWithdrawReentrancyGuard() public {
        MaliciousReceiver receiver = new MaliciousReceiver(payable(address(pool)));
        vm.deal(address(receiver), 100 ether);

        receiver.deposit{value: 2 ether}();

        vm.prank(address(receiver));
        vm.expectRevert();
        receiver.attackWithdraw(2 ether);
    }

    function testClaimDividendReentrancyGuard() public {
        MaliciousReceiver receiver = new MaliciousReceiver(payable(address(pool)));
        vm.deal(address(receiver), 100 ether);

        receiver.deposit{value: 10 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 2 ether}();

        vm.prank(address(receiver));
        vm.expectRevert();
        receiver.attackClaim();
    }
}

contract MaliciousReceiver {
    FundraisingPool private pool;
    bool private attacking;

    constructor(address payable _pool) {
        pool = FundraisingPool(_pool);
    }

    function deposit() external payable {
        pool.deposit{value: msg.value}();
    }

    function attackWithdraw(uint256 amount) external {
        attacking = true;
        pool.withdraw(amount);
    }

    function attackClaim() external {
        attacking = true;
        pool.claimDividend();
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            pool.withdraw(1);
        }
    }
}
