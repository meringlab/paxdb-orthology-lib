/**
 * Created by milans on 09/07/15.
 */
var should = require('chai').should(),
    expect = require('chai').expect,
    assert = require('assert');

var storage = require('../storage/neo4j/index')
var sampleDataset =
    "#name: D.vulgaris - Whole organism (Integrated)\n\
#score: 4.46\n\
#weight:\n\
#description: integrated dataset: weighted average of all D.vulgaris WHOLE_ORGANISM datasets<br/><b>Interaction consistency score</b>: 4.46&nbsp<b>Coverage</b>: 28\n\
#organ: WHOLE_ORGANISM\n\
#integrated : true\n\
#coverage: 28\n\
#publication_year: 2015\n\
#filename: 882-WHOLE_ORGANISM-integrated.txt\n\
#\n\
#internal_id	string_external_id	abundance\n\
4574	882.DVU0956	4191\n\
4575	882.DVU0957	1870\n\
4572	882.DVU0954	6.94\n\
4573	882.DVU0955	836\n\
4571	882.DVU0953	256\n\
4569	882.DVU0951	53.7\n\
6961	882.DVU3373	553\n\
";

describe('storage helper functions', function () {
    it('should parse dataset', function () {
        var parsed = storage._internal.parseDataset(sampleDataset)
        parsed.organ.should.equal('WHOLE_ORGANISM')
        parsed.numAbundances.should.equal(7)
        expect(parsed.abundances[0]).to.deep.equal({iid: 4574, eid: '882.DVU0956', value: 4191})
        expect(parsed.abundances[2]).to.deep.equal({iid: 4572, eid: '882.DVU0954', value: 6.94})
        expect(parsed.abundances[6]).to.deep.equal({iid: 6961, eid: '882.DVU3373', value: 553})
    })
})

