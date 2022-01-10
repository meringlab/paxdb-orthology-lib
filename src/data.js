const fs = require('fs');
const path = require('path');

const ORTHOLOGY_SPECIES_MAP = path.join(__dirname, '../', 'data/ontology/ontology_2_species.tsv');
const ORTHOLOGY_LEVELS_MAP = path.join(__dirname, '../', 'data/ontology/cogs.txt');

exports = module.exports = {}; //eslint-disable-line no-multi-assign

function loadOrthgroups() {
    let orthgroups = {}
    const filecontents = fs.readFileSync(ORTHOLOGY_LEVELS_MAP, { encoding: 'utf8' });
    filecontents.split('\n').forEach((line) => {
        const rec = line.split(': ');
        if (rec.length < 2) {
            return;
        }
        let orth_id = parseInt(rec[0])
        orthgroups[orth_id] = rec[1];
    }); 
    return orthgroups;
}

exports.orthgroups = loadOrthgroups();

function loadSpeciesTissuesMap() {
    const contents = fs.readFileSync(ORTHOLOGY_SPECIES_MAP, { encoding: 'utf8' });
    const map = {};
    contents.split('\n').forEach((line) => {
        const rec = line.split('\t');
        if (rec.length < 2) {
            return;
        }
        if (!(rec[0] in map)) {
            map[rec[0]] = [];
        }
        map[rec[0]].push(rec[1]);
    });
    return map;
}

exports.speciesTissuesMap = loadSpeciesTissuesMap();