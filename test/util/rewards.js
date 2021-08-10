const { time } = require('@openzeppelin/test-helpers');
const { ZERO, ONE, toBig } = require('./big');

function rewardsModel(stakingStartInput, lspExpirationInput, stakingDOMInput, totalStakedInput) {
  const stakingStart = toBig(stakingStartInput);
  const lspExpiration = toBig(lspExpirationInput);
  const stakingDOM = toBig(stakingDOMInput);
  const totalStaked = toBig(totalStakedInput);

  const stakingPeriod = time.duration.days(7);
  const rewardPeriod = time.duration.days(120);
  const stakingEnds = stakingStart.add(stakingPeriod);
  const penaltyEnds = stakingEnds.add(rewardPeriod);

  /**
   * @param {Big.Big} timestamp 
   * @returns {Big.Big}
   */
  function reward(timestamp) {
    // Reward function from reqs doc, in seconds
    if (timestamp.lt(stakingEnds)) {
      return ZERO;
    }
    if (timestamp.lt(lspExpiration)) {
      const offset = timestamp.sub(stakingStart);
      const numerator = offset.sub(stakingPeriod).pow(2);
      const denominator = lspExpiration.sub(stakingStart).sub(stakingPeriod).pow(2);
      return numerator.div(denominator);
    }
    return ONE;
  }
  
  function penalty(timestamp) {
    if (timestamp.lt(stakingEnds)) {
      return ONE;
    }
    if(timestamp.lt(penaltyEnds)) {
      const offset = timestamp.sub(stakingStart);
      const numerator = offset.sub(stakingPeriod);
      const denominator = time.duration.days(rewardPeriod - stakingPeriod);
      return ONE.minus(numerator.div(denominator));
    }
    return ZERO;
  }
  
  function totalReward(withdrawAmountInput, timestampInput) {
    const withdrawAmount = toBig(withdrawAmountInput);
    const timestamp = toBig(timestampInput);

    const result = stakingDOM
      .mul(withdrawAmount)
      .mul(reward(timestamp))
      .mul(ONE.minus(penalty(timestamp)))
      .div(totalStaked);

    console.log(
      'totalReward',
      {
        stakingDOM: stakingDOM.toFixed(),
        timestamp: timestamp.toFixed(),
        reward: reward(timestamp).toFixed(),
        penalty: penalty(timestamp).toFixed(),
        totalStaked: totalStaked.toFixed(),
        totalReward: result.toFixed(),
      }
    );
      
    return result;
  }

  return totalReward;
}

module.exports = {
  rewardsModel
};
