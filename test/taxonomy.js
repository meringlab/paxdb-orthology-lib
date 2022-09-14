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
      'GAMMAPROTEOBACTERIA'
    ]);
    taxonomy.taxonomicLevels(9606).should.deep.equal([
      'LUCA',
      'EUKARYOTA',
      'OPISTHOKONTA',
      'METAZOA',
      'CHORDATA',
      'MAMMALIA',
      'EUARCHONTOGLIRES',
      'PRIMATES'
    ])
  });
  it('should return all species under a taxonomic level', function() {
    taxonomy.allSpeciesUnder('PRIMATES').should.deep.equal([9544, 9598, 9606])
    taxonomy.allSpeciesUnder('RODENTIA').should.deep.equal([10090, 10116])
    taxonomy.allSpeciesUnder('EUARCHONTOGLIRES').should.deep.equal([9544, 9598, 9606, 9986, 10090, 10116])
  });
  it('should return all tissues under a taxonomic level', function() {
    taxonomy.availableTissuesAtTaxonomicLevel('BACTERIA').should.deep.equal(['WHOLE_ORGANISM'])
    taxonomy.availableTissuesAtTaxonomicLevel('PRIMATES')[0].should.equal('ADRENAL_GLAND')
    taxonomy.availableTissuesAtTaxonomicLevel('RODENTIA')[0].should.equal('ADRENAL_GLAND')
  });
  describe('family tree', function() {
    it('root should be at the requested level', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YHR174W'}
      ], 'SACCHAROMYCETES');
      tree.name.should.equal('SACCHAROMYCETES');
    });

    it('should only have the requested species', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YHR174W'}
      ], 'SACCHAROMYCETES');
      tree.children.length.should.equal(1);
      tree.children[0].id.should.equal(4932);

      var tree = taxonomy.proteinFamilyTree([
        {'id': '5476.CADANGAP00013996'}
      ], 'SACCHAROMYCETES');
      tree.children.length.should.equal(1);
      tree.children[0].id.should.equal(5476);

      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YGR254W'},
        {'id': '5476.CADANGAP00013996'}
      ], 'SACCHAROMYCETES');
      tree.name.should.equal('SACCHAROMYCETES');
      tree.children.length.should.equal(2);
      tree.children[0].id.should.equal(4932);
      tree.children[1].id.should.equal(5476);
    });

    it('should recognise when species is at the same level as orthgroup', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YGR254W'},
        {'id': '214684.someprot'}
      ], 'FUNGI');
      // console.log(tree)
      tree.children.length.should.equal(2);
      tree.children[1].id.should.equal(214684);
      var saccharomycetes = tree.children[0];
      // console.log(saccharomycetes)
      // console.log(saccharomycetes.children)
      saccharomycetes.id.should.equal(4891);
      saccharomycetes.children[0].id.should.equal(4932);

    });

    it('should remove empty groups', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '9606.ENSP00000229277'}
      ], 'MAMMALIA');
      tree.children.length.should.equal(1);
    });

    it('should have proteins assigned to species', function() {
      var tree = taxonomy.proteinFamilyTree([
        {'id': '4932.YHR174W'}
      ], 'SACCHAROMYCETES');
      var yeast = tree.children[0];
      yeast.proteins.length.should.equal(1);
      yeast.proteins[0].id.should.equal('4932.YHR174W');
    })


  })
});
