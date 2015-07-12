const fs = require('fs')

exports = module.exports = {}

exports.orthgroups = {
    "1": "LUCA",
    "2": "BACTERIA",
    "543": "ENTEROBACTERIACEAE",
    "1117": "CYANOBACTERIA",
    "1224": "PROTEOBACTERIA",
    "1236": "GAMMAPROTEOBACTERIA",
    "1239": "FIRMICUTES",
    "1385": "BACILLALES",
    "2157": "ARCHAEA",
    "2759": "EUKARYOTES",
    "4447": "LILIOPSIDA",
    "4751": "FUNGI",
    "4890": "ASCOMYCETES",
    "5653": "KINETOPLASTS",
    "6656": "ARTHROPODS",
    "7147": "DIPTERA",
    "7711": "CHORDATES",
    "8287": "SARCOPTERYGII",
    "9443": "PRIMATES",
    "9989": "RODENTS",
    "29547": "EPSILONPROTEOBACTERIA",
    "32524": "AMNIOTES",
    "33090": "GREENPLANTS",
    "33154": "OPISTHOKONTS",
    "33208": "METAZOA",
    "33316": "COELOMATA",
    "35493": "STREPTOPHYTA",
    "40674": "MAMMALS",
    "68525": "DEPROTEOBACTERIA",
    "91561": "CETARTIODACTYLA",
    "186817": "BACILLACEAE",
    "186826": "LACTOBACILLALES",
    "314145": "LAURASIATHERIA",
    "314146": "EUARCHONTOGLIRES",
    "716545": "SACCHAROMYCETA"
}

exports.speciesTissuesMap = loadSpeciesTissuesMap()
exports.taxonomicTree = loadTree()

function loadSpeciesTissuesMap() {
    const contents = fs.readFileSync('./data/v4.0/ontology/ontology_2_species.tsv', {'encoding': 'utf8'});
    const map = {}
    contents.split('\n').forEach(function (line) {
        var rec = line.split('\t');
        if (rec.length < 2) {
            return
        }
        if (!(rec[0] in map)) {
            map[rec[0]] = []
        }
        map[rec[0]].push(rec[1])
    })
    return map
}

function loadTree() {
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

