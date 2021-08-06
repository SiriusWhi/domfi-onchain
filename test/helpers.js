const { time, BN } = require('@openzeppelin/test-helpers');

function rewardsModel(stakingStart, lspExpiration, stakingDOM, totalStaked) {
  const stakingEnds = stakingStart.add(time.duration.days(7));
  const penaltyEnds = stakingEnds.add(time.duration.days(120));

  function reward(timestamp) {
    // Reward function from reqs doc, in seconds
    if (timestamp < stakingEnds) {
      return 0;
    }
    if (timestamp < lspExpiration) {
      const offset = timestamp.sub(stakingStart);
      const numerator = offset.sub(time.duration.days(7)).pow(new BN(2));
      const denominator = lspExpiration.sub(stakingStart).sub(time.duration.days(7)).pow(new BN(2));
      return numerator.toNumber() / denominator.toNumber();
    }
    return 1;
  }
  
  function penalty(timestamp) {
    if (timestamp < stakingEnds) {
      return 1;
    }
    if(timestamp < penaltyEnds) {
      const offset = timestamp.sub(stakingStart);
      const numerator = offset.sub(time.duration.days(7));
      const denominator = time.duration.days(120-7);
      return 1 - numerator / denominator;
    }
    return 0;
  }

  function numToWeiBN(a) {
    return new BN(web3.utils.toWei(a.toFixed(18)));
  }
  
  function totalReward(withdrawAmount, timestamp) {
    return stakingDOM
      .mul(new BN(withdrawAmount))
      .mul(numToWeiBN(reward(timestamp)))
      .mul(numToWeiBN(1 - penalty(timestamp)))
      .div(totalStaked)
      .div(numToWeiBN(1)) // jank fixed point
      .div(numToWeiBN(1))
    ;
  }

  return totalReward;
}


function dateString(epoch) {
  if (!epoch) { return 0; }
  return new Date(epoch * 1000).toISOString();
}

exports.rewardsModel = rewardsModel;
exports.dateString = dateString;