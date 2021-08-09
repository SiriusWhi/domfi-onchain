
function dateString(epoch) {
  if (!epoch) { return 0; }
  return new Date(epoch * 1000).toISOString();
}

module.exports = {
  dateString,
};
