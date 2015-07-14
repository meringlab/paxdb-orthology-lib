const fs = require('fs')
const data = require('./data')
const _und = require('underscore')

exports = module.exports = {}
exports.taxonomicLevels = taxonomicLevels
exports.allSpeciesUnder = allSpeciesUnder
exports.isValidTaxonomicLevel = isValidTaxonomicLevel
exports.availableTissuesAtTaxonomicLevel = availableTissuesAtTaxonomicLevel

var taxonomicMap = loadMap()
var taxonomicMapById = (function () {
    var m = {}
    for (var prop in taxonomicMap) {
        if (taxonomicMap.hasOwnProperty(prop)) {
            m[taxonomicMap[prop].name] = taxonomicMap[prop]
        }
    }
    return m
})()


function availableTissuesAtTaxonomicLevel(taxonomicLevel) {
    return allSpeciesUnder(taxonomicLevel).reduce(function (prev, speciesId) {
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
    return (taxonomicLevel in taxonomicLevels(speciesId));
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
    if (!level.hasOwnProperty('children')) {
        throw Error(taxonomicLevel + " is empty!? " + JSON.stringify(level))
    }
    var children = []
    appendLeaves(level, children)
    return children.sort(function (a, b) {
        return a > b
    })
}

function appendLeaves(level, children) {
    level.children.forEach(function (child) {
        if (child.hasOwnProperty('children')) {
            appendLeaves(child, children)
        } else {
            children.push(child.id)
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
    var records = contents.split('\n').filter(function (el) {
        return el[0] !== '#'
    });
    const map = {}

    function getParent(rec) {
        if (!(rec[1] in map)) {
            map[rec[1]] = {id: parseInt(rec[1]), name: rec[3].toUpperCase(), children: []}
        } else {
            if (!map[rec[1]].hasOwnProperty('children')) {
                map[rec[1]].children = []
            }
        }
        return map[rec[1]]
    }

    function getChild(rec) {
        var child = (rec[0] in map) ? map[rec[0]] : {id: parseInt(rec[0]), name: rec[2].toUpperCase()}
        map[rec[0]] = child
        return child
    }

    records.forEach(function (line) {
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
