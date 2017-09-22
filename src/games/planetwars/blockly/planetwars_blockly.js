var Blockly = require("node-blockly/browser");
const Blocks = require("./src/blocks");
const PlanetWars = require("./src/planetwars");


// happier colours
Blockly.HSV_SATURATION = 0.6;
Blockly.HSV_VALUE = 0.8;
Blocks.inject(Blockly);

const toolbox = {
  'entities': [
    'entities_planets',
    'entities_expeditions',
    'entities_players',
    'entities_player',
    'entities_nobody'
  ],
  'functions': [
    'functions_owner',
    'functions_ship_count',
    'functions_origin',
    'functions_target',
    'functions_turns_remaining',
    'functions_distance',
    'functions_dispatch'
  ],
  'lists': [
    'lists_filter',
    'lists_minmax'
  ],
  'logic': [
    'logic_boolean',
    'logic_compare',
    'logic_null',
    'logic_operation',
    'logic_ternary'
  ],
  'variables': [
    'variables_set',
    'variables_get'
  ],
  'math': [
    'math_arithmetic',
    'math_change',
    'math_constant',
    'math_constrain',
    'math_modulo',
    'math_number',
    'math_number_property',
    'math_on_list',
    'math_random_float',
    'math_random_int',
    'math_round',
    'math_single',
    'math_trig'
  ]
};

// construct toolbox xml
function toolbox_xml(toolbox) {
  var toolbox_str = '<xml>';
  Object.entries(toolbox).forEach(([cat_name, cat_entries]) => {
    toolbox_str += '<category name="' + cat_name + '">';
    cat_entries.forEach(block_name => {
      toolbox_str += '<block type="' + block_name + '"></block>';
    });
    toolbox_str += '</category>';
  });
  toolbox_str += '</xml>';
  return toolbox_str;
}

function inject(div_id) {
  var tb = toolbox_xml(toolbox);
  var workspace = Blockly.inject(div_id, { toolbox: tb });
  return new PlanetWarsBlockly(workspace);
}

console.log(Blockly.Blocks);

class PlanetWarsBlockly {
  constructor(workspace) {
    this.workspace = workspace;
  }

  getCode() {
    return Blockly.JavaScript.workspaceToCode(this.workspace);
  }

  getXml() {
    var xml = Blockly.Xml.workspaceToDom(this.workspace);
    var xml_text = Blockly.Xml.domToText(xml);
    return xml_text;
  }

  loadXml(xml_text) {
    var xml = Blockly.Xml.textToDom(xml_text);
    Blockly.Xml.domToWorkspace(xml, this.workspace);
  }

  addChangeListener(fun) {
    this.workspace.addChangeListener(fun);
  }

};

module.exports = {
  inject
};
