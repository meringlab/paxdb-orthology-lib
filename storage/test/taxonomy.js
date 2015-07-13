/**
 * Created by milans on 13/07/15.
 */
var should = require('chai').should(),
    expect = require('chai').expect,
    assert = require('assert');


var taxonomy = require('../storage/taxonomy')

describe('taxonomy', function () {
    it('should return all taxonomic levels in ascending order for a species', function () {
        taxonomy.taxonomicLevels(198214/*shigella*/).should.deep.equal(['LUCA',
            'BACTERIA',
            'PROTEOBACTERIA',
            'GAMMAPROTEOBACTERIA',
            'ENTEROBACTERIACEAE'])
        taxonomy.taxonomicLevels(9606).should.deep.equal(['LUCA',
            'EUKARYOTES',
            'OPISTHOKONTS',
            'METAZOA',
            'COELOMATA',
            'CHORDATES',
            'SARCOPTERYGII',
            'AMNIOTES',
            'MAMMALS',
            'EUARCHONTOGLIRES',
            'PRIMATES'
        ])
    })
})
