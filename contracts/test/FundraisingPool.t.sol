// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FundraisingPool} from "../src/FundraisingPool.sol";

/// @notice Unit tests for FundraisingPool — deposit/mint, burn/withdraw, dividends.
contract FundraisingPoolTest is Test {
    FundraisingPool private pool;

    address private admin = address(0xA11CE);
    address private alice = address(0xA11CE1);
    address private bob = address(0xB0B);
    address private carol = address(0xCAFE);
    address private attacker = address(0xBAD);

    /// @notice Deploy a fresh pool and fund test accounts before each test.
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
        assertEq(pool.holderCount(), 1);
    }

    function testDepositMultipleAccounts() public {
        vm.prank(alice);
        pool.deposit{value: 3 ether}();
        vm.prank(bob);
        pool.deposit{value: 7 ether}();

        assertEq(pool.balanceOf(alice), 3 ether);
        assertEq(pool.balanceOf(bob), 7 ether);
        assertEq(pool.totalSupply(), 10 ether);
        assertEq(pool.holderCount(), 2);
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

    function testWithdrawFullBalanceRemovesHolder() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        vm.prank(alice);
        pool.withdraw(5 ether);

        assertEq(pool.balanceOf(alice), 0);
        assertEq(pool.holderCount(), 0);
        assertEq(pool.allHolders().length, 0);
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
    // Dividend Distribution
    // ---------------------------------------------------------------

    function testDistributeDividendsSingleHolder() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 1 ether}();

        assertEq(pool.claimableDividends(alice), 1 ether);
        assertEq(pool.totalDividendsDistributed(), 1 ether);
    }

    function testDistributeDividendsProportional() public {
        vm.prank(alice);
        pool.deposit{value: 3 ether}(); // 30%
        vm.prank(bob);
        pool.deposit{value: 7 ether}(); // 70%

        vm.prank(admin);
        pool.distributeDividends{value: 10 ether}();

        // Alice: 3/10 = 30% of 10 ether = 3 ether
        // Bob:   7/10 = 70% of 10 ether = 7 ether
        assertEq(pool.claimableDividends(alice), 3 ether);
        assertEq(pool.claimableDividends(bob), 7 ether);
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

        assertEq(pool.claimableDividends(alice), 20 ether);
        assertEq(pool.claimableDividends(bob), 30 ether);
        assertEq(pool.claimableDividends(carol), 50 ether);
    }

    function testDistributeDividendsZeroSupplyReverts() public {
        vm.prank(admin);
        vm.expectRevert(FundraisingPool.InvalidAmount.selector);
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
        emit FundraisingPool.DividendsDistributed(admin, 1 ether, 1);
        pool.distributeDividends{value: 1 ether}();
    }

    // ---------------------------------------------------------------
    // Claim Dividends
    // ---------------------------------------------------------------

    function testClaimDividendsTransfersETH() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 2 ether}();

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        pool.claimDividends();

        assertEq(alice.balance, balanceBefore + 2 ether);
        assertEq(pool.claimableDividends(alice), 0);
    }

    function testClaimDividendsEmitsEvent() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 1 ether}();

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit FundraisingPool.DividendClaimed(alice, 1 ether);
        pool.claimDividends();
    }

    function testClaimDividendsNothingReverts() public {
        vm.prank(alice);
        pool.deposit{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert(FundraisingPool.NoDividendsToClaim.selector);
        pool.claimDividends();
    }

    function testClaimDividendsTwiceDoesNotDoubleSpend() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        vm.prank(admin);
        pool.distributeDividends{value: 1 ether}();

        vm.prank(alice);
        pool.claimDividends();

        vm.prank(alice);
        vm.expectRevert(FundraisingPool.NoDividendsToClaim.selector);
        pool.claimDividends();
    }

    // ---------------------------------------------------------------
    // Multiple Distribution Rounds
    // ---------------------------------------------------------------

    function testMultipleDistributionRoundsAccumulate() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();
        vm.prank(bob);
        pool.deposit{value: 5 ether}();

        // Round 1
        vm.prank(admin);
        pool.distributeDividends{value: 2 ether}();

        assertEq(pool.claimableDividends(alice), 1 ether);
        assertEq(pool.claimableDividends(bob), 1 ether);

        // Round 2 — balances unchanged
        vm.prank(admin);
        pool.distributeDividends{value: 4 ether}();

        assertEq(pool.claimableDividends(alice), 3 ether);
        assertEq(pool.claimableDividends(bob), 3 ether);

        assertEq(pool.totalDividendsDistributed(), 6 ether);
    }

    // ---------------------------------------------------------------
    // Holder Tracking via Transfers
    // ---------------------------------------------------------------

    function testTransferAddsNewHolder() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        vm.prank(alice);
        pool.transfer(bob, 4 ether);

        assertEq(pool.balanceOf(alice), 6 ether);
        assertEq(pool.balanceOf(bob), 4 ether);
        assertEq(pool.holderCount(), 2);

        address[] memory holders = pool.allHolders();
        assertEq(holders.length, 2);
    }

    function testTransferRemovesSenderWhenBalanceZero() public {
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        vm.prank(alice);
        pool.transfer(bob, 5 ether);

        assertEq(pool.balanceOf(alice), 0);
        assertEq(pool.balanceOf(bob), 5 ether);
        assertEq(pool.holderCount(), 1);
        assertEq(pool.allHolders()[0], bob);
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

        // Alice should still be able to claim dividends accrued before transfer
        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        pool.claimDividends();
        assertEq(alice.balance, balanceBefore + 2 ether);

        // Bob has tokens now but no dividends yet
        assertEq(pool.claimableDividends(bob), 0);
    }

    // ---------------------------------------------------------------
    // Edge Cases
    // ---------------------------------------------------------------

    function testAllHoldersReturnsCorrectList() public {
        vm.prank(alice);
        pool.deposit{value: 1 ether}();
        vm.prank(bob);
        pool.deposit{value: 1 ether}();
        vm.prank(carol);
        pool.deposit{value: 1 ether}();

        address[] memory holders = pool.allHolders();
        assertEq(holders.length, 3);
        assertEq(holders[0], alice);
        assertEq(holders[1], bob);
        assertEq(holders[2], carol);
    }

    function testETHBalanceMatchesTotalSupply() public {
        vm.prank(alice);
        pool.deposit{value: 10 ether}();
        vm.prank(bob);
        pool.deposit{value: 5 ether}();

        // Contract ETH = deposits only (not dividends)
        assertEq(address(pool).balance, 15 ether);

        // After withdraw, ETH and supply both decrease
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

    /// @notice Reentrancy guard: a malicious contract cannot re-enter withdraw.
    function testWithdrawReentrancyGuard() public {
        MaliciousReceiver receiver = new MaliciousReceiver(address(pool));
        vm.deal(address(receiver), 100 ether);

        // Give the receiver some tokens via deposit
        receiver.deposit{value: 2 ether}();

        // The receiver's receive() tries to call withdraw again
        vm.prank(address(receiver));
        vm.expectRevert();
        receiver.attackWithdraw(2 ether);
    }
}

/// @notice Malicious contract that attempts reentrancy on FundraisingPool.
contract MaliciousReceiver {
    FundraisingPool private pool;
    bool private attacking;

    constructor(address _pool) {
        pool = FundraisingPool(_pool);
    }

    function deposit() external payable {
        pool.deposit{value: msg.value}();
    }

    function attackWithdraw(uint256 amount) external {
        attacking = true;
        pool.withdraw(amount);
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            // Try to re-enter withdraw — should fail due to ReentrancyGuard
            pool.withdraw(1);
        }
    }
}
