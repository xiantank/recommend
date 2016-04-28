"use strict";

var expect = require('chai').expect;
var Recommend = require('../src/Recommend.js');

describe("test Recommend", function () {
	this.timeout(5000);

	it("Recommend.getKeywords", function (done) {
		let recommend = new Recommend();
		let fakeRecord = [
			{
				"title": "Google News",
				"url": "https://news.google.com/",
				"content": "Comprehensive up-to-date <b>news</b> coverage, aggregated from sources all over the \nworld by Google <b>News</b>."
			},
			{
				"title": "Fox News - Breaking News Updates | Latest News Headlines ...",
				"url": "http://www.foxnews.com/",
				"content": "Offers worldwide <b>news</b> coverage, analysis, show profiles, broadcast schedules, \nteam biographies, and email <b>news</b> alerts."
			}
		];
		let fakeResults = [
			["aggregated", "coverage", "comprehensive", "news", "sources"],
			["alerts", "schedules", "email", "biographies", "profiles"]
		];
		recommend.getKeywords(fakeRecord).then(results=> {
			expect(results).is.deep.equal(fakeResults);
			done();
		});

	});

	it('Recommend.getInterest("7pXOuoYL")', function(done){
		let recommend = new Recommend();
		let userId = "7pXOuoYL";
		recommend.getInterest(userId).then(results=>{
			expect(results).to.be.a("object");
			expect(results.userId).is.equal(userId);
			expect(results.keywords).to.be.instanceof(Array);
			expect(results.tags).to.be.instanceof(Array);
			expect(results.subscribe).to.be.instanceof(Array);
			done();
		});
	});

});