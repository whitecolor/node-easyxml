/*jshint strict:false*/
/*global __dirname describe it require*/

var assert  = require("chai").assert,
    fs      = require("fs"),
    path    = require("path"),

    easyXML = require("../index.js");

var DEFAULT_OPTIONS = {
            singularizeChildren: true,
            underscoreAttributes: true,
            rootElement: 'response',
            dateFormat: 'ISO',
            indent: 2,
            manifest: true
        };

describe("Node EasyXML", function () {
  var should = {
        "names"  : "should parse a JSON object into XML",
        "names1" : "should parse a JSON object with attrs into XML",
        "names2" : "should parse a JSON object with attrs and text node into XML",
        "singularizeChildren" : "should parse a JSON object without singularizeChildren to XML",
        "singularizeChildren2" : "should parse a JSON object without singularizeChildren to XML (with object)"
      };

  Object.keys(should)
    .forEach(function(name){
      it(should[name], function (done) {
        if (name === 'singularizeChildren' || name === 'singularizeChildren2') {
          easyXML.configure({ singularizeChildren: false });
        } else {
          easyXML.configure({ singularizeChildren: true });
        }

        var file = __dirname + "/fixtures/" + name;

        fs.readFile(file + ".xml", "UTF-8", function (err, data) {
          if (err) {
            throw err;
          }

          var json = require(file + ".json");

          assert.equal(easyXML.render(json), data, "EasyXML should create the correct XML from a JSON data structure.");
          assert.strictEqual(easyXML.render(json), data, "EasyXML should create the correct XML from a JSON data structure.");

          done();
        });
      });
    });
});
