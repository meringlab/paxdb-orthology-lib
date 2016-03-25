const fs = require('fs')
const data = require('./data')
const _und = require('underscore')

exports = module.exports = {}
exports.taxonomicLevels = taxonomicLevels
exports.allSpeciesUnder = allSpeciesUnder
exports.isValidTaxonomicLevel = isValidTaxonomicLevel
exports.availableTissuesAtTaxonomicLevel = availableTissuesAtTaxonomicLevel
exports.proteinFamilyTree = proteinFamilyTree

//use union type
const LEVEL_TYPE = {ORTHGROUP: 'orthgroup', SPECIES: 'species'};

var taxonomicMap = loadMap()
// exports.taxonomicMap = taxonomicMap;

var taxonomicMapById = (function() {
  var m = {}
  for (var prop in taxonomicMap) {
    if (taxonomicMap.hasOwnProperty(prop)) {
      m[taxonomicMap[prop].name] = taxonomicMap[prop]
    }
  }
  return m
})()

/**
 *
 * @param proteins array of protein objects
 * @param taxonomicLevel LUCA, BACTERIA, EUKARYOTES...
 * @return {{}} family tree
 */
//TODO tissue equivalence
function proteinFamilyTree(proteins, taxonomicLevel) {
  //todo assert proteins is an array
  if (!proteins || proteins.length === 0) {
    return {}
  }
  var level = getLevel(taxonomicLevel);
  //need to clone but can't use JSON.parse/stringify because it's circular
  var tree = cloneTree(level);
  var inputSpeciesMap = {}
  _und.forEach(proteins, function(p) {
    var speciesId = p.id.split('.')[0];
    if (!(speciesId in inputSpeciesMap)) {
      inputSpeciesMap[speciesId] = [];
    }
    inputSpeciesMap[speciesId].push(p);
  })
  var species = []
  depthFirstTraversal(tree, function(node) {
    if (node.type === LEVEL_TYPE.SPECIES && node.id in inputSpeciesMap) {
      species.push(node);
    }
    if (node.type === LEVEL_TYPE.ORTHGROUP) {
      var i = node.children.length
      while (i--) {
        if (node.children[i].type === LEVEL_TYPE.SPECIES
          && !(node.children[i].id in inputSpeciesMap)) {
          node.children.splice(i, 1);
        }
      }
      //continue search thru children
      //only afterwards cleanup this node if empty
    }
  }, function(node) {
    //cleanup empty orthgroups
    if (node.type === LEVEL_TYPE.ORTHGROUP) {
      var i = node.children.length
      while (i--) {
        if (node.children[i].type === LEVEL_TYPE.ORTHGROUP
          && node.children[i].children.length === 0) {
          node.children.splice(i, 1);
        }
      }
    }
  })
  _und.forEach(species, function(s) {
    s.proteins = inputSpeciesMap[s.id]
  })
  //sort children so it's easier to test
  depthFirstTraversal(tree, function(node) {
    if (node.type === LEVEL_TYPE.ORTHGROUP) {
      node.children.sort(function(c1, c2) {
        return c1.id - c2.id
      });
    }
  });
  return tree;
}

//doesn't handle Dates!
function cloneTree(obj) {
  if (null == obj || "object" != typeof obj) return obj;

  // Handle Date
  if (obj instanceof Date) {
    throw new Error('i cant handle Dates!')
  }

  if (obj instanceof Array) {
    var copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = cloneTree(obj[i]);
    }
    return copy;
  }

  if (obj instanceof Object) {
    var copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr) && 'parent' !== attr) {
        copy[attr] = cloneTree(obj[attr]);
      }
    }
    return copy;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
}

function availableTissuesAtTaxonomicLevel(taxonomicLevel) {
  return allSpeciesUnder(taxonomicLevel).reduce(function(prev, speciesId) {
    return _und.union(prev, data.speciesTissuesMap[speciesId]);
  }, []).sort()
}

/**
 * validates whether param is a legal/known taxonomic level and
 * whether the level is legal for this species.
 *
 * @param speciesId
 * @param taxonomicLevel
 * @return {boolean}
 */
function isValidTaxonomicLevel(speciesId, taxonomicLevel) {
  return _und.contains(taxonomicLevels(speciesId), taxonomicLevel);
}

function getLevel(taxonomicLevel) {
  var level = (typeof(taxonomicLevel) === 'number') ? taxonomicMap[taxonomicLevel] : taxonomicMapById[taxonomicLevel]
  if (level === undefined) {
    throw Error("unknown taxonomic level: " + taxonomicLevel)
  }
  return level;
}

function allSpeciesUnder(taxonomicLevel) {
  var level = getLevel(taxonomicLevel);
  if (level.type !== LEVEL_TYPE.ORTHGROUP || !level.hasOwnProperty('children')) {
    throw Error(taxonomicLevel + " is empty!? " + level.name)
  }
  var children = []
  appendLeaves(level, children)
  return children.sort(function(a, b) {
    return a > b
  })
}

function depthFirstTraversal(root, visitor, postVistor) {
  visitor(root);
  if (root.children) {
    root.children.forEach(function(child) {
      depthFirstTraversal(child, visitor, postVistor);
    });
  }
  if (postVistor) {
    postVistor(root)
  }
}

function appendLeaves(level, children) {
  depthFirstTraversal(level, function(node) {
    //node.type === 'species' ?
    // if (!node.hasOwnProperty('children')) {
    if (node.type === LEVEL_TYPE.SPECIES) {
      children.push(node.id)
    }
  })
}

/**
 * @param speciesId
 * @return ordered list of all taxonomic levels for this species
 */
function taxonomicLevels(speciesId) {
  if (!(speciesId in taxonomicMap)) {
    //throw Error("unknown species " + speciesId + ", we only have: " + )
    throw Error("unknown species " + speciesId)
  }
  var species = taxonomicMap[speciesId];
  if (species.hasOwnProperty('children')) {
    throw Error("not species (but taxonomic level): " + species.name)
  }
  var levels = []
  for (var parent = species.parent; parent !== undefined; parent = parent.parent) {
    levels.push(parent.name)
  }
  levels.reverse()
  return levels
}


function loadMap() {
  const contents = fs.readFileSync('./data/v4.0/ontology/taxonomy_tree.tsv', {'encoding': 'utf8'});
  var records = contents.split('\n').filter(function(el) {
    return el[0] !== '#'
  });
  const map = {}

  function getType(id) {
    return id in data.orthgroups ? LEVEL_TYPE.ORTHGROUP : LEVEL_TYPE.SPECIES;
  }

  function getParent(rec) {
    if (!(rec[1] in map)) {
      map[rec[1]] = {id: parseInt(rec[1]), name: rec[3].toUpperCase(), type: getType(rec[1]), children: []}
    } else {
      if (!map[rec[1]].hasOwnProperty('children')) {
        map[rec[1]].children = []
      }
    }
    return map[rec[1]]
  }

  function getChild(rec) {
    var child = (rec[0] in map) ? map[rec[0]] : {
      id: parseInt(rec[0]),
      name: rec[2].toUpperCase(),
      type: getType(rec[0])
    }
    map[rec[0]] = child
    return child
  }

  records.forEach(function(line) {
    var rec = line.split('\t');
    if (rec.length < 4) {
      return
    }
    var parent = getParent(rec)
    var child = getChild(rec)
    parent.children.push(child)
    child.parent = parent
  })
  return map
}
