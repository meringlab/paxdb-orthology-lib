/**
 * Created by milans on 13/07/15.
 */
var should = require('chai').should(),
  expect = require('chai').expect,
  assert = require('assert');


var taxonomy = require('../src/taxonomy');

describe('taxonomy', function() {
  it('should return all taxonomic levels in ascending order for a species', function() {
    taxonomy.taxonomicLevels(198214/*shigella*/).should.deep.equal([
      'LUCA',
      'BACTERIA',
      'PROTEOBACTERIA',
      'GAMMAPROTEOBACTERIA',
      'ENTEROBACTERIACEAE'
    ]);
    taxonomy.taxonomicLevels(9606).should.deep.equal([
      'LUCA',
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
  });
  it('should return all species under a taxonomic level', function() {
    taxonomy.allSpeciesUnder('PRIMATES').should.deep.equal([9598, 9606])
    taxonomy.allSpeciesUnder('RODENTS').should.deep.equal([10090, 10116])
    taxonomy.allSpeciesUnder('EUARCHONTOGLIRES').should.deep.equal([9598, 9606, 10090, 10116])
  });
  it('should return all tissues under a taxonomic level', function() {
    taxonomy.availableTissuesAtTaxonomicLevel('BACTERIA').should.deep.equal(['WHOLE_ORGANISM'])
    taxonomy.availableTissuesAtTaxonomicLevel('PRIMATES')[0].should.equal('ADRENAL_GLAND')
    taxonomy.availableTissuesAtTaxonomicLevel('RODENTS')[0].should.equal('ADRENAL_GLAND')
  });
  describe('family tree', function() {
    it('root should be at the requested level', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YHR174W'}
      ], 'SACCHAROMYCETA');
      tree.name.should.equal('SACCHAROMYCETA');
    });

    it('should only have the requested species', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YHR174W'}
      ], 'SACCHAROMYCETA');
      tree.children.length.should.equal(1);
      tree.children[0].id.should.equal(4932);

      var tree = taxonomy.proteinFamilyTree([
        {'id': '5061.CADANGAP00013996'}
      ], 'SACCHAROMYCETA');
      tree.children.length.should.equal(1);
      tree.children[0].id.should.equal(5061);

      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YGR254W'},
        {'id': '5061.CADANGAP00013996'}
      ], 'SACCHAROMYCETA');
      tree.name.should.equal('SACCHAROMYCETA');
      tree.children.length.should.equal(2);
      tree.children[0].id.should.equal(4932);
      tree.children[1].id.should.equal(5061);
    });

    it('should recognise when species is at the same level as orthgroup', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YGR254W'},
        {'id': '214684.someprot'}
      ], 'FUNGI');
      tree.children.length.should.equal(2);
      tree.children[1].id.should.equal(214684);
      var ascomycetes = tree.children[0];
      ascomycetes.id.should.equal(4890);
      ascomycetes.children[0].id.should.equal(716545);
    });

    it('should remove empty groups', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '9606.ENSP00000229277'}
      ], 'MAMMALS');
      tree.children.length.should.equal(1);
    });

    it('should have proteins assigned to species', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YHR174W'}
      ], 'SACCHAROMYCETA');
      var yeast = tree.children[0];
      yeast.proteins.length.should.equal(1);
      yeast.proteins[0].id.should.equal('4932.YHR174W');
    })


  })
});
