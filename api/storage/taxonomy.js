const fs = require('fs')

exports = module.exports = {}
exports.taxonomicLevels = taxonomicLevels

var taxonomicMap = loadMap()

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
