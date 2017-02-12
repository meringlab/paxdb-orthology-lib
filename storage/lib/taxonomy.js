const fs = require('fs');
const data = require('./data');
const _und = require('underscore');

const TAXONOMY_TREE = './data/v4.0/ontology/taxonomy_tree.tsv';

//use union type
const LEVEL_TYPE = { ORTHGROUP: 'orthgroup', SPECIES: 'species' };
const taxonomicMap = loadMap(); //eslint-disable-line  no-use-before-define

// exports.taxonomicMap = taxonomicMap;

const taxonomicMapById = (() => {
    const m = {};
    for (const prop in taxonomicMap) {
        if (taxonomicMap.hasOwnProperty(prop)) {
            m[taxonomicMap[prop].name] = taxonomicMap[prop];
        }
    }
    return m;
})();


//doesn't handle Dates!
function cloneTree(obj) {
    if (obj === null || typeof obj !== 'object') return obj;

    // Handle Date
    if (obj instanceof Date) {
        throw new Error('i cant handle Dates!');
    }

    if (obj instanceof Array) {
        const copy = [];
        for (let i = 0, len = obj.length; i < len; i++) {
            copy[i] = cloneTree(obj[i]);
        }
        return copy;
    }

    if (obj instanceof Object) {
        const copy = {};
        for (const attr in obj) {
            if (obj.hasOwnProperty(attr) && attr !== 'parent') {
                copy[attr] = cloneTree(obj[attr]);
            }
        }
        return copy;
    }

    throw new Error('Unable to copy obj! Its type isn\'t supported.');
}

function getLevel(taxonomicLevel) {
    let level;
    if (typeof(taxonomicLevel) === 'number') {
        level = taxonomicMap[taxonomicLevel];
    } else {
        level = taxonomicMapById[taxonomicLevel];
    }
    if (level === undefined) {
        throw Error(`unknown taxonomic level: ${taxonomicLevel}`);
    }
    return level;
}


/**
 * @param speciesId
 * @return ordered list of all taxonomic levels for this species
 */
function taxonomicLevels(speciesId) {
    if (!(speciesId in taxonomicMap)) {
        //throw Error("unknown species " + speciesId + ", we only have: " + )
        throw Error(`unknown species ${speciesId}`);
    }
    const species = taxonomicMap[speciesId];
    if (species.hasOwnProperty('children')) {
        throw Error(`not species (but taxonomic level): ${species.name}`);
    }
    const levels = [];
    for (let parent = species.parent; parent !== undefined; parent = parent.parent) {
        levels.push(parent.name);
    }
    levels.reverse();
    return levels;
}

function depthFirstTraversal(root, visitor, postVistor) {
    visitor(root);
    if (root.children) {
        root.children.forEach(child => {
            depthFirstTraversal(child, visitor, postVistor);
        });
    }
    if (postVistor) {
        postVistor(root);
    }
}

function appendLeaves(level, children) {
    depthFirstTraversal(level, node => {
        if (node.type === LEVEL_TYPE.SPECIES) {
            children.push(node.id);
        }
    });
}

function allSpeciesUnder(taxonomicLevel) {
    const level = getLevel(taxonomicLevel);
    if (level.type !== LEVEL_TYPE.ORTHGROUP || !level.hasOwnProperty('children')) {
        throw Error(`${taxonomicLevel} is empty!? ${level.name}`);
    }
    const children = [];
    appendLeaves(level, children);
    return children.sort((a, b) => a > b);
}

function availableTissuesAtTaxonomicLevel(taxonomicLevel) {
    function reducer(prev, speciesId) {
        return _und.union(prev, data.speciesTissuesMap[speciesId]);
    }

    return allSpeciesUnder(taxonomicLevel).reduce(reducer, []).sort();
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
        return {};
    }
    const level = getLevel(taxonomicLevel);
    //need to clone but can't use JSON.parse/stringify because it's circular
    const tree = cloneTree(level);
    const inputSpeciesMap = {};
    _und.forEach(proteins, p => {
        const speciesId = p.id.split('.')[0];
        if (!(speciesId in inputSpeciesMap)) {
            inputSpeciesMap[speciesId] = [];
        }
        inputSpeciesMap[speciesId].push(p);
    });
    const species = [];
    depthFirstTraversal(tree, node => {
        if (node.type === LEVEL_TYPE.SPECIES && node.id in inputSpeciesMap) {
            species.push(node);
        }
        if (node.type === LEVEL_TYPE.ORTHGROUP) {
            let i = node.children.length;
            while (i--) {
                if (node.children[i].type === LEVEL_TYPE.SPECIES
                    && !(node.children[i].id in inputSpeciesMap)) {
                    node.children.splice(i, 1);
                }
            }
            //continue search thru children
            //only afterwards cleanup this node if empty
        }
    }, node => {
        //cleanup empty orthgroups
        if (node.type === LEVEL_TYPE.ORTHGROUP) {
            let i = node.children.length;
            while (i--) {
                if (node.children[i].type === LEVEL_TYPE.ORTHGROUP
                    && node.children[i].children.length === 0) {
                    node.children.splice(i, 1);
                }
            }
        }
    });
    _und.forEach(species, s => {
        s.proteins = inputSpeciesMap[s.id];
    });
    //sort children so it's easier to test
    depthFirstTraversal(tree, node => {
        if (node.type === LEVEL_TYPE.ORTHGROUP) {
            node.children.sort((c1, c2) => c1.id - c2.id);
        }
    });
    return tree;
}

function loadMap() {
    const contents = fs.readFileSync(TAXONOMY_TREE, { encoding: 'utf8' });
    const records = contents.split('\n').filter(el => el[0] !== '#');
    const map = {};

    function getType(id) {
        return id in data.orthgroups ? LEVEL_TYPE.ORTHGROUP : LEVEL_TYPE.SPECIES;
    }

    function getParent(rec) {
        if (!(rec[1] in map)) {
            map[rec[1]] = {
                id: parseInt(rec[1], 10),
                name: rec[3].toUpperCase(),
                type: getType(rec[1]),
                children: []
            };
        } else {
            if (!map[rec[1]].hasOwnProperty('children')) {
                map[rec[1]].children = [];
            }
        }
        return map[rec[1]];
    }

    function getChild(rec) {
        const child = (rec[0] in map) ? map[rec[0]] : {
            id: parseInt(rec[0], 10),
            name: rec[2].toUpperCase(),
            type: getType(rec[0])
        };
        map[rec[0]] = child;
        return child;
    }

    records.forEach(line => {
        const rec = line.split('\t');
        if (rec.length < 4) {
            return;
        }
        const parent = getParent(rec);
        const child = getChild(rec);
        parent.children.push(child);
        child.parent = parent;
    });
    return map;
}

exports = module.exports = {};
exports.taxonomicLevels = taxonomicLevels;
exports.allSpeciesUnder = allSpeciesUnder;
exports.isValidTaxonomicLevel = isValidTaxonomicLevel;
exports.availableTissuesAtTaxonomicLevel = availableTissuesAtTaxonomicLevel;
exports.proteinFamilyTree = proteinFamilyTree;
