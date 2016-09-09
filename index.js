const
	dns = require('dns'),
	net = require('net'),
	Promise = require('bluebird'),
	ping = require('net-ping'),
	stats = require('stats-lite');


const dnsLookup = Promise.promisify(dns.lookup);

function resolveHost(host) {
	return new Promise((resolve, reject) => {
		if (net.isIP(host)) {
			resolve(host);
		} else {
			dnsLookup(host).then(resolve);
		}
	});
}

const _start = new Date();
const _results = [];
var _counter = 1;

function addPingResult(index, ms) {
	_results[index - 1] = ms;
}

function printStatistics() {
	const
		count = _results.length,
		elapsed = new Date() - _start,
		min = Math.min.apply(null, _results),
		max = Math.max.apply(null, _results),
		avg = stats.mean(_results),
		median = stats.median(_results),
		stdev = stats.stdev(_results),
		quintiles = [
			stats.percentile(_results, 0.2),
			stats.percentile(_results, 0.4),
			stats.percentile(_results, 0.6),
			stats.percentile(_results, 0.8),
		];

	console.log('\n--- ping statistics ---');
	console.log(`${count} requests over ${elapsed}ms`);
	console.log(`min ${min}ms / max ${max}ms / median ${median}ms / avg ${avg}ms / stdev ${stdev}ms`);
	console.log(`quintiles ${quintiles[0]}ms / ${quintiles[1]}ms / ${quintiles[2]}ms / ${quintiles[3]}ms`);
}

function sendPing(session, host, address) {
	const sequenceNum = _counter;
	_counter += 1;

	return new Promise((resolve, reject) => {
		session.pingHost(address, (err, target, sent, rcvd) => {
			if (err) {
				reject(err);
			} else {
				resolve([target, sent, rcvd]);
			}
		})
	})
	.then(([target, sent, rcvd]) => {
		const ms = rcvd - sent;
		console.log(`PING ${sequenceNum}: ${session.packetSize} bytes from ${host} (${address}): ${ms}ms`);
		addPingResult(sequenceNum, ms);
	});
}

function pingRepeatedly(session, host, address, interval) {
	setInterval(
		() => { sendPing(session, host, address) },
		interval
	);
}

function main(argv) {
	console.log(`Sonar v0.0.1`);
	console.log();

	const
		host = argv._[0],
		packetSize = argv.packetSize,
		interval = argv.interval;

	const session = ping.createSession({
		packetSize: packetSize
	});

	resolveHost(host)
	.then((address) => {
		console.log(`PING ${host} (${address})`);

		pingRepeatedly(session, host, address, interval);

		process.on('SIGINT', () => {
			printStatistics();
			process.exit(0);
		});
	});
}

const argv = require('yargs')
    .usage('Usage: $0 [host]')
    .demand(1)
    .default('packetSize', 16)
    .default('interval', 1000)
    .argv;

main(argv);
