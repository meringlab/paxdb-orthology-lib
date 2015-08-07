/**
 * Created by milans on 09/07/15.
 */
var should = require('chai').should(),
    expect = require('chai').expect,
    assert = require('assert');

var importer = require('../storage/neo4j/import')()
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

var sampleOrthologs = "NOG04004	3334697	4186372\n\
NOG04005	3335926	4186578\n\
NOG04006	4186917	3335696	3334537\n\
NOG04007	4188181	3335027\n";

describe('storage helper functions', function () {
    it('should parse dataset', function () {
        var parsed = importer._internal.parseDataset(sampleDataset)
        parsed.organ.should.equal('WHOLE_ORGANISM')
        parsed.numAbundances.should.equal(7)
        expect(parsed.abundances[0]).to.deep.equal({iid: 4574, eid: '882.DVU0956', value: 4191})
        expect(parsed.abundances[2]).to.deep.equal({iid: 4572, eid: '882.DVU0954', value: 6.94})
        expect(parsed.abundances[6]).to.deep.equal({iid: 6961, eid: '882.DVU3373', value: 553})
    })
    it('should parse orthologs', function () {
        var parsed = importer._internal.parseOrthgroups(2759, sampleOrthologs)
        parsed.length.should.equal(4)
        expect(parsed[0]).to.deep.equal({
            "id": 2759, "clade": "EUKARYOTES", "members": [3334697, 4186372], "name": "2759.NOG04004"
        })
        expect(parsed[2]).to.deep.equal({
            "id": 2759,
            "clade": "EUKARYOTES",
            "members": [4186917, 3335696, 3334537],
            "name": "2759.NOG04006"
        })
        expect(parsed[3]).to.deep.equal({
            "id": 2759,
            "clade": "EUKARYOTES",
            "members": [4188181, 3335027],
            "name": "2759.NOG04007"
        })
    })
})

