/**
 * Created by Xiantank on 2016/4/26.
 */
"use strict";
var request = require("request-promise");
var fs = require("fs");
var privateKey = require("../privateKey.json");
/**
 * @class
 */
class Recommend {
	constructor(options) {
		options = options || {};
		this.cseKey = privateKey.cseKey;
		this.cseCx = privateKey.cseCx;
		this.maxSearchSize = options.maxSearchSize || 40;
		this.searchSize = options.searchSize || 8;
		this.searchMethod = options.searchMethod || "googleWebSearchAPI";
	}

	get searchAPI() {
		let that = this;
		let searchStrategy = {
			/**
			 * parsing google web search api return results (deprecate api)
			 * @param body
			 * @returns {GoogleSearchRecord[]}
			 */
			googleWebSearchAPI: {
				makeRequestOptions: function (start, query) {
					let options = {};
					options.uri = "https://ajax.googleapis.com/ajax/services/search/web";
					options.qs = {
						v: "1.0",
						rsz: "8",
						start: start,
						q: query
					};
					options.simple = false;
					options.transform = this.transform;
					return options;
				},
				transform: function (body) {
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

					let results;
					try {
						results = JSON.parse(body).responseData.results;
					} catch (e) {
						console.log(e);
						console.log(body);
						return null;
					}

					return results.map(function (result) {
						return {
							title: result.titleNoFormatting || result.title,
							url: result.url,
							content: result.content
						};
					});

				}
			},
			/**
			 * parsing google web search api return results (deprecate api)
			 * @param body
			 * @returns {GoogleSearchRecord[]}
			 */
			googleCustomSearchAPI: {
				makeRequestOptions: function (start, query) {
					let options = {};
					options.uri = "https://www.googleapis.com/customsearch/v1";
					options.qs = {
						fields: "searchInformation,items(title,htmlTitle,link,formattedUrl,snippet,htmlSnippet)",
						key: that.cseKey,
						cx: that.cseCx,
						start: start + 1,
						q: query
					};
					options.simple = false;
					options.transform = this.transform;
					return options;
				},
				transform: function (body) {
					/** @typedef {object} json
					 * @property {object[]} items
					 * @property {string} items.formattedUrl
					 * @property {string} items.htmlSnippet
					 * @property {string} items.htmlTitle
					 * @property {string} items.link
					 * @property {string} items.snippet
					 * @property {string} items.title
					 * @property {object} searchInformation
					 * @property {string} searchInformation.formattedSearchTime
					 * @property {string} searchInformation.formattedTotalResults
					 * @property {number} searchInformation.searchTime
					 * @property {string} searchInformation.totalResults
					 */
					let results;
					try {
						results = JSON.parse(body).items;
					} catch (e) {
						console.log(e);
						console.log(body);
						return null;
					}

					return results.map(function (result) {
						return {
							title: result.title || result.htmlTitle,
							url: result.link || result.formattedUrl,
							content: result.snippet || result.htmlSnippet
						};
					});
				}
			}
		};
		return searchStrategy[this.searchMethod];
	}

	/** @typedef {object} GoogleSearchRecord
	 * @property {string} content
	 * @property {string} title
	 * @property {string} url
	 */
	/**
	 *
	 * @param {String} query
	 * @return {Promise} results: GoogleSearchRecord[]
	 */
	makeQuery(query) {
		let requestOptionsArray = [];
		let results = [];

		for (let start = 0; start < this.maxSearchSize; start += this.searchSize) {
			requestOptionsArray.push(this.searchAPI.makeRequestOptions(start, query));
		}
		let sequentialRequest = function (requestOptionsArray) {
			let option = requestOptionsArray.shift();
			if (option) {
				return request.get(option).then((record)=> {
					results.push(record);
					return sequentialRequest(requestOptionsArray);
				}).catch(err=> {
					console.error("@makeQuery.sequentialRequest", err);
					return sequentialRequest(requestOptionsArray);
				});
			} else {
				return Promise.resolve(
					results.reduce((p, r)=> {
						if (!p || !r) return p || r;
						return p.concat(r);
					}));
			}

		};
		return sequentialRequest(requestOptionsArray);
	}


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

	getQuery(query) {
		return this.makeQuery(query).then(results=> {
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
		return request.get(uri).then(body=>JSON.parse(body));
	}

	rankResult(userId, query) {
		return Promise.all([
			this.getQuery(query),
			this.getInterest(userId)
		]).then((results)=> {
			let queryResult = results[0];
			let interestList = results[1];
			return this.rankByScoringKeywords(queryResult, interestList);
		})//.catch(e=>console.log(e));
	}

	rankByScoringKeywords(queryResult, interestList) {
		let termScoreMap = new Map();
		for (let key in interestList) {
			if (!interestList.hasOwnProperty(key)) continue;
			let terms = interestList[key];
			if (!Array.isArray(terms)) {
				continue;
			}
			for (let term of terms) {
				termScoreMap.set(term, 1.1);
			}
		}
		let totalNum = this.maxSearchSize;
		queryResult = queryResult.map((record, index)=> {
			record.baseScore = 1 + (1 - index / totalNum) * 0.5;
			record.finalScore = record.baseScore;
			for (let term of record.keywords) {
				let score;
				if (score = termScoreMap.get(term)) {
					record.finalScore *= score;
				}
			}
			return record;
		});
		queryResult = queryResult.sort((a, b) => {
			return b.finalScore - a.finalScore;
		});
		fs.writeFile("sorted_query_news_byScoringKeywords.json", JSON.stringify(queryResult, null, 4));
		return queryResult;

	}


}
// let recommend = new Recommend({
// 	maxSearchSize: 40,
// 	searchSize: 10,
// 	searchMethod: "googleCustomSearchAPI"
// });
// let query = "news";
// let userId = "7pXOuoYL";
//recommend.rankResult(userId, query);

module.exports = Recommend;
