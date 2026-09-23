import compression from 'compression';
import { constants } from 'node:zlib';

export const responseCompression = () =>
  compression({
    threshold: 1024,
    level: 4,
    brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } },
    filter: (req, res) =>
      req.path !== '/dashboard/stream' && req.path !== '/signin' && compression.filter(req, res),
  });
