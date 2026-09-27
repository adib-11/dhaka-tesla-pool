import { buildApp, logger } from './app';
import { config } from './config';

buildApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));
