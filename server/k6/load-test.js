import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metric to track status codes count
const statusCode2xx = new Counter('status_2xx');
const statusCode3xx = new Counter('status_3xx');
const statusCode4xx = new Counter('status_4xx');
const statusCode5xx = new Counter('status_5xx');

// Read dynamic options from environment variables
const vus = __ENV.VUS ? parseInt(__ENV.VUS, 10) : 10;
const duration = __ENV.DURATION || '10s';

let testOptions = {
  vus: vus,
  duration: duration,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  discardResponseBodies: false,
  thresholds: {},
};

if (__ENV.STAGES) {
  try {
    const parsedStages = JSON.parse(__ENV.STAGES);
    if (Array.isArray(parsedStages) && parsedStages.length > 0) {
      testOptions.stages = parsedStages;
      delete testOptions.vus;
      delete testOptions.duration;
    }
  } catch (e) {
    // Fallback to default vus & duration
  }
}

export const options = testOptions;

export default function () {
  const url = __ENV.TARGET_URL;
  if (!url) {
    throw new Error('TARGET_URL environment variable is required');
  }

  const method = (__ENV.TARGET_METHOD || 'GET').toUpperCase();
  const rawHeaders = __ENV.TARGET_HEADERS;
  const rawBody = __ENV.TARGET_BODY;
  const expectedStatus = __ENV.EXPECTED_STATUS ? parseInt(__ENV.EXPECTED_STATUS, 10) : 200;
  const timeout = __ENV.TIMEOUT || '10s';

  let headers = {};
  if (rawHeaders) {
    try {
      headers = JSON.parse(rawHeaders);
    } catch (e) {
      // Fallback
    }
  }

  const params = {
    headers: headers,
    timeout: timeout,
    tags: {
      api_name: __ENV.API_NAME || 'registered_api',
    },
  };

  const res = http.request(method, url, rawBody || null, params);

  // Status code categorizations
  if (res.status >= 200 && res.status < 300) {
    statusCode2xx.add(1);
  } else if (res.status >= 300 && res.status < 400) {
    statusCode3xx.add(1);
  } else if (res.status >= 400 && res.status < 500) {
    statusCode4xx.add(1);
  } else if (res.status >= 500) {
    statusCode5xx.add(1);
  }

  // Response validation check
  check(res, {
    'status is expected': (r) => (expectedStatus ? r.status === expectedStatus : r.status >= 200 && r.status < 400),
  });
}

export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH || 'summary.json';
  return {
    [summaryPath]: JSON.stringify(data),
  };
}
