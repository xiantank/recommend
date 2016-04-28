/**
 * Created by Xiantank on 2016/4/26.
 */
"use strict";
var request = require("request-promise");
/**
 * @class
 */
class Recommend {
	constructor() {
		this.queryServer = "https://ajax.googleapis.com/ajax/services/search/web?v=1.0&rsz=8";
	}

	/**
	 *
	 * @param {String} query
	 * @param {Number} maxSize
	 * @return {Promise} results: GoogleSearchRecord[]
	 */
	makeQuery(query, maxSize) {
		maxSize = maxSize || 64;
		let promiseArray = [];
		let options = {
			uri: '',
			simple: false,
			transform: function (body) {
				try {
					/** @typedef {object} json
					 * @property {object} responseData
					 * @property {object[]} responseData.results
					 * @property {string} responseData.results.GsearchResultClass
					 * @property {string} responseData.results.cacheUrl
					 * @property {string} responseData.results.content
					 * @property {string} responseData.results.title
					 * @property {string} responseData.results.titleNoFormatting
					 * @property {string} responseData.results.unescapedUrl
					 * @property {string} responseData.results.url
					 * @property {string} responseData.results.visibleUrl
					 * @property {null} responseDetails
					 * @property {number} responseStatus
					 */
					let results = JSON.parse(body).responseData.results;

					return results.map(function (result) {
						return {
							title: result.titleNoFormatting || result.title,
							url: result.url,
							content: result.content
						};
					});
				} catch (err) {
					console.error(err);
					return null;
				}
			}
		};
		for (let start = 0; start < maxSize; start += 8) {
			options.uri = `${this.queryServer}&start=${start}&q=${query}`;
			promiseArray.push(request(options));
		}
		return Promise.all(promiseArray).then(results=>results.reduce((p, r)=> {
			if (!p || !r) return p || r;
			return p.concat(r);
		}));
	}

	/** @typedef {object} GoogleSearchRecord
	 * @property {string} content
	 * @property {string} title
	 * @property {string} url
	 */
	/**
	 *
	 * @param {GoogleSearchRecord[]} records
	 * @returns {Promise} results: string[][]
	 */
	getKeywords(records) {
		var url = 'http://140.123.101.168:8080/~ycp104/segment/socket.php';

		let promiseArray = records.map(function (record) {
			var req = request.post(url);
			var form = req.form();
			form.append('json', JSON.stringify(record));
			return req.then(body=> {
				return JSON.parse(body).Keyword;
			}).catch(err=>console.error(err));
		});
		return Promise.all(promiseArray);

	}

	getQuery(query, maxResult) {
		return this.makeQuery(query, maxResult).then(results=> {
			return this.getKeywords(results).then(keywords=> {
				return results.map((record, index)=> {
					record.keywords = keywords[index];
					return record;
				});
			});
		});
	}

	/** @typedef {object} Interest
	 * @property {string[]} keywords
	 * @property {string[]} subscribe
	 * @property {string[]} tags
	 * @property {string} userId
	 */
	/**
	 *
	 * @param userId
	 * @returns {Interest}
	 */
	getInterest(userId) {
		var uri = `http://tan.csie.io:2234/${userId}/personal/`;
		return request(uri).then(body=>JSON.parse(body));
	}

	rankResult() {
	}


}
let startTime = process.hrtime();
let recommend = new Recommend();
let query = "news";
recommend.getQuery(query, 64).catch(err=>console.error(err));
/* recommend.makeQuery(query, 64).then((results)=> {
 console.log(JSON.stringify(results, null, 4));
 });

 */
process.on("exit", function () {
	let passTime = process.hrtime(startTime);
	console.log((passTime[0] * 1000 + passTime[1] / 1000000) + "ms");
});
module.exports = Recommend;