const config = require('./config');
const app = require('./app');
const { startRetentionJob } = require('./services/loginProtection');

startRetentionJob();

app.listen(config.port, () => {
  console.log(`YSIS backend listening on port ${config.port} (${config.nodeEnv})`);
});
