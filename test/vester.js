const {
  time
} = require('@openzeppelin/test-helpers');

const Vester = artifacts.require("Vester");
const Dom = artifacts.require("DominationToken");

const buildVester = async (owner) => {
  dom = await Dom.new([owner]);

  await time.advanceBlock();
  start = await time.latest();

  const vester = await Vester.new(
    dom.address,
    owner, // recipient
    1, // uint vestingAmount_,
    start, // uint vestingBegin_,
    start, // uint vestingCliff_,
    start + 2000, // uint vestingEnd_,
    0, // uint timeout_,
    {
      from: owner
    }
  );

  console.log(vester.address)

  await dom.grantRole(web3.utils.sha3("TRANSFER"), vester.address);
  return vester
}

contract("Vester", accounts => {

  before('setup contracts', async () => {
    vester = await buildVester(accounts[0])
  })

  it("should emit all tokens after vesting is done", () =>
    vester.claim()
      .then(instance => 1)
      .then(result => {
          assert.strictEqual(1,1,"bad thing happened");
      })
  );

  it("should do something else", () =>
  vester.claim()
    .then(instance => 1)
    .then(result => {
        assert.strictEqual(1,1,"bad thing happened");
    })
);
  
});