const Swap = artifacts.require('Swap')
const Wrapper = artifacts.require('Wrapper')
const WETH9 = artifacts.require('WETH9')
const FungibleToken = artifacts.require('FungibleToken')
const MockContract = artifacts.require('MockContract')

const { equal, reverted, passes } = require('@airswap/test-utils').assert
const { takeSnapshot, revertToSnapShot } = require('@airswap/test-utils').time
const { EMPTY_ADDRESS } = require('@airswap/order-utils').constants

contract('Wrapper Unit Tests', async accounts => {
  const takerAmount = 2
  const mockToken = accounts[9]
  const mockTaker = accounts[8]
  const r = web3.utils.asciiToHex('r')
  const s = web3.utils.asciiToHex('s')
  let mockSwap
  let mockWeth
  let mockFT
  let wrapper
  let wethTemplate
  let fungibleTokenTemplate
  let weth_balance
  let mock_transfer
  let swap_swapSimple
  let snapshotId

  beforeEach(async () => {
    let snapShot = await takeSnapshot()
    snapshotId = snapShot['result']
  })

  afterEach(async () => {
    await revertToSnapShot(snapshotId)
  })

  async function setupMockWeth() {
    mockWeth = await MockContract.new()

    wethTemplate = await WETH9.new()

    weth_balance = wethTemplate.contract.methods
      .balanceOf(EMPTY_ADDRESS)
      .encodeABI()

    //mock the weth.approve method
    let weth_approve = wethTemplate.contract.methods
      .approve(EMPTY_ADDRESS, 0)
      .encodeABI()
    await mockWeth.givenMethodReturnBool(weth_approve, true)

    // mock the weth.allowance method
    let weth_allowance = wethTemplate.contract.methods
      .allowance(EMPTY_ADDRESS, EMPTY_ADDRESS)
      .encodeABI()
    await mockWeth.givenMethodReturnUint(weth_allowance, 100000)

    // mock the weth.balanceOf method
    let weth_wrapper_balance = wethTemplate.contract.methods
      .balanceOf(EMPTY_ADDRESS)
      .encodeABI()
    await mockWeth.givenMethodReturnUint(weth_wrapper_balance, 100000)

    //mock the weth.transferFrom method
    let weth_transferFrom = wethTemplate.contract.methods
      .transferFrom(EMPTY_ADDRESS, EMPTY_ADDRESS, 0)
      .encodeABI()
    await mockWeth.givenMethodReturnBool(weth_transferFrom, true)
  }

  async function setupMockSwap() {
    let swapTemplate = await Swap.new()
    //mock the swap.swapSimple method
    swap_swapSimple = swapTemplate.contract.methods
      .swapSimple(
        0,
        0,
        EMPTY_ADDRESS,
        0,
        EMPTY_ADDRESS,
        EMPTY_ADDRESS,
        0,
        EMPTY_ADDRESS,
        27,
        r,
        s
      )
      .encodeABI()

    mockSwap = await MockContract.new()
  }

  async function setupMockFungibleToken() {
    mockFT = await MockContract.new()
    fungibleTokenTemplate = await FungibleToken.new()

    mock_transfer = fungibleTokenTemplate.contract.methods
      .transfer(EMPTY_ADDRESS, 0)
      .encodeABI()
    await mockFT.givenMethodReturnBool(mock_transfer, true)
  }

  before('deploy Wrapper', async () => {
    await setupMockWeth()
    await setupMockSwap()
    await setupMockFungibleToken()
    wrapper = await Wrapper.new(mockSwap.address, mockWeth.address)
  })

  describe('Test initial values', async () => {
    it('Test initial Swap Contract', async () => {
      let val = await wrapper.swapContract.call()
      equal(val, mockSwap.address, 'swap address is incorrect')
    })

    it('Test initial Weth Contract', async () => {
      let val = await wrapper.wethContract.call()
      equal(val, mockWeth.address, 'weth address is incorrect')
    })
  })

  describe('Test swapSimple', async () => {
    it('Test when taker token != weth, ensure no unexpected ether sent', async () => {
      let nonTakerToken = mockToken
      await reverted(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          EMPTY_ADDRESS, //maker token
          EMPTY_ADDRESS, //taker wallet
          0, //taker amount
          nonTakerToken, //taker token
          27, //v
          r,
          s,
          { value: 2 }
        ),
        'VALUE_MUST_BE_ZERO'
      )
    })

    it('Test when taker token == weth, ensure the taker wallet is unset', async () => {
      await reverted(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          EMPTY_ADDRESS, //maker token
          mockTaker, //taker wallet
          0, //taker amount
          mockWeth.address, //taker token
          27, //v
          r,
          s,
          { value: 2, from: mockTaker }
        ),
        'TAKER_WALLET_MUST_BE_UNSET'
      )
    })

    it('Test when taker token == weth, ensure the taker amount matches sent ether', async () => {
      await reverted(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          EMPTY_ADDRESS, //maker token
          EMPTY_ADDRESS, //taker wallet
          1, //taker amount
          mockWeth.address, //taker token
          27, //v
          r,
          s,
          { value: 2, from: mockTaker }
        ),
        'VALUE_MUST_BE_SENT'
      )
    })

    it('Test when taker token == weth, maker token == weth, and the transaction passes', async () => {
      //mock the weth.balance method
      await mockWeth.givenMethodReturnUint(weth_balance, 0)

      await passes(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          mockWeth.address, //maker token
          EMPTY_ADDRESS, //taker wallet
          takerAmount, //taker amount
          mockWeth.address, //taker token
          27, //v
          r,
          s,
          { value: takerAmount, from: mockTaker }
        )
      )

      //check if swap_swapSimple() was called
      let invocationCount = await mockSwap.invocationCountForMethod.call(
        swap_swapSimple
      )
      equal(
        invocationCount.toNumber(),
        1,
        "swap contact's swap.swapSimple was not called the expected number of times"
      )
    })

    it('Test when taker token == weth, maker token != weth, and the transaction passes', async () => {
      let notWethContract = mockFT.address
      await passes(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          notWethContract, //maker token
          EMPTY_ADDRESS, //taker wallet
          takerAmount, //taker amount
          mockWeth.address, //taker token
          27, //v
          r,
          s,
          { value: takerAmount }
        )
      )

      //check if swap_swapSimple() was called
      let invocationCount = await mockSwap.invocationCountForMethod.call(
        swap_swapSimple
      )
      equal(
        invocationCount.toNumber(),
        1,
        "swap contact's swap.swapSimple was not called the expected number of times"
      )
    })

    /**
     * Scenario for failure: The taker sends in WETH which means that when the trade succeeds the taker wallet
     * is the wrapper contract and the swap is between the maker token and the wrapper contract. The token needs
     * to be returned to the taker. Certain ERC20 contract return a boolean instead of reverting on failure and
     * thus if the final transfer from wrapper contract to maker fails the overall transaction should revert to
     * ensure no tokens are left in the wrapper contract.
     */
    it('Test when taker token == weth, maker token != weth, and the wrapper token transfer fails', async () => {
      await mockFT.givenMethodReturnBool(mock_transfer, false)
      let notWethContract = mockFT.address
      await reverted(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          notWethContract, //maker token
          EMPTY_ADDRESS, //taker wallet
          takerAmount, //taker amount
          mockWeth.address, //taker token
          27, //v
          r,
          s,
          { value: takerAmount }
        )
      )

      //check if swap_swapSimple() was called
      let invocationCount = await mockSwap.invocationCountForMethod.call(
        swap_swapSimple
      )
      equal(
        invocationCount.toNumber(),
        0,
        "swap contact's swap.swapSimple was not called the expected number of times"
      )
    })
  })

  describe('Test sending two ERC20s', async () => {
    it('Test when taker token == non weth erc20, maker token == non weth erc20 but msg.sender is not takerwallet', async () => {
      let nonMockTaker = accounts[7]
      let notWethContract = mockFT.address
      await reverted(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          EMPTY_ADDRESS, //maker token
          nonMockTaker, //taker wallet
          1, //taker amount
          notWethContract, //taker token
          27, //v
          r,
          s,
          { value: 0, from: mockTaker }
        ),
        'SENDER_NOT_TAKERWALLET'
      )
    })

    it('Test when taker token == non weth erc20, maker token == non weth erc20, and the transaction passes', async () => {
      let notWethContract = mockFT.address
      await passes(
        wrapper.swapSimple(
          0, //nonce
          0, //expiry
          EMPTY_ADDRESS, //maker wallet
          0, //maker amount
          notWethContract, //maker token
          mockTaker, //taker wallet
          takerAmount, //taker amount
          notWethContract, //taker token
          27, //v
          r,
          s,
          { value: 0, from: mockTaker }
        )
      )

      //check if swap_swapSimple() was called
      let invocationCount = await mockSwap.invocationCountForMethod.call(
        swap_swapSimple
      )
      equal(
        invocationCount.toNumber(),
        1,
        "swap contact's swap.swapSimple was not called the expected number of times"
      )
    })
  })
})
