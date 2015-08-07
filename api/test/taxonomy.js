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
    it('should return all species under a taxonomic level', function () {
        taxonomy.allSpeciesUnder('PRIMATES').should.deep.equal([9598, 9606])
        taxonomy.allSpeciesUnder('RODENTS').should.deep.equal([10090, 10116])
        taxonomy.allSpeciesUnder('EUARCHONTOGLIRES').should.deep.equal([9598, 9606, 10090, 10116])
    })
    it('should return all tissues under a taxonomic level', function () {
        taxonomy.availableTissuesAtTaxonomicLevel('BACTERIA').should.deep.equal(['WHOLE_ORGANISM'])
        taxonomy.availableTissuesAtTaxonomicLevel('PRIMATES')[0].should.equal('ADRENAL_GLAND')
        taxonomy.availableTissuesAtTaxonomicLevel('RODENTS')[0].should.equal('ADRENAL_GLAND')
    })


})
