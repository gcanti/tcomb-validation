/** @jsx React.DOM */

$(function () {

'use strict';

var t = require('../index');
var React = require('react');
var bs = require('tcomb-react-bootstrap');
var v = t.addons.validation.validate;

//
// import all bootstrap components
//

var Accordion = bs.Accordion;
var Affix = bs.Affix;
var Alert = bs.Alert;
var Badge = bs.Badge;
var Button = bs.Button;
var ButtonGroup = bs.ButtonGroup;
var ButtonToolbar = bs.ButtonToolbar;
var Carousel = bs.Carousel;
var CarouselItem = bs.CarouselItem;
var Col = bs.Col;
var DropdownButton = bs.DropdownButton;
var DropdownMenu = bs.DropdownMenu;
var Glyphicon = bs.Glyphicon;
var Grid = bs.Grid;
var Input = bs.Input;
var Jumbotron = bs.Jumbotron;
var Label = bs.Label;
var MenuItem = bs.MenuItem;
var Modal = bs.Modal;
var ModalTrigger = bs.ModalTrigger;
var Nav = bs.Nav;
var Navbar = bs.Navbar;
var NavItem = bs.NavItem;
var OverlayTrigger = bs.OverlayTrigger;
var PageHeader = bs.PageHeader;
var PageItem = bs.PageItem;
var Pager = bs.Pager;
var Panel = bs.Panel;
var PanelGroup = bs.PanelGroup;
var Popover = bs.Popover;
var ProgressBar = bs.ProgressBar;
var Row = bs.Row;
var SplitButton = bs.SplitButton;
var SubNav = bs.SubNav;
var TabbedArea = bs.TabbedArea;
var Table = bs.Table;
var TabPane = bs.TabPane;
var Tooltip = bs.Tooltip;
var Well = bs.Well;

//
// utils
//

function repo(name, title) {
  title = title || name;
  return <a href="https://github.com/gcanti/{name}">{title}</a>
}

function toPropTypes(Struct) {
  
  var propTypes = {};
  var props = Struct.meta.props;
  
  Object.keys(props).forEach(function (k) {
    // React custom prop validator
    // see http://facebook.github.io/react/docs/reusable-components.html
    propTypes[k] = function (values, name, component) {
      var opts = {
        path: ['this.props.' + name], 
        messages: ':path of value `:actual` supplied to `' + component + '`, expected a `:expected`'
      };
      return window.validate(values[name], props[name], opts).firstError();
    }
  });

  return propTypes;
}

//
// setup
//

// if true, open the debugger when a failure occurs
var isDebuggerEnabled = false;

// override default fail behaviour of tcomb https://github.com/gcanti/tcomb
t.options.onFail = function (message) {
  if (isDebuggerEnabled) {
    debugger;
  }
  throw new Error(message);
};

var scripts = {
  primitives: {
    label: 'Primitives (Native JavaScript types)'
  },
  subtypes: {
    label: '`subtype` combinator (Subtypes)'
  },
  objects: {
    label: '`struct` combinator (Classes)'
  },
  lists: {
    label: '`list` combinator (Lists)'
  },
  tuples: {
    label: '`tuple` combinator (Tuples)'
  },
  enums: {
    label: '`enums` combinator (Enums)'
  },
  unions: {
    label: '`union` combinator (Unions)'
  },
  dict: {
    label: '`dict` combinator (Dictionaries)'
  },
  nested: {
    label: 'Validating nested structures'
  },
  form: {
    label: 'Form validation'
  },
  jsonschema: {
    label: 'an alternative syntax for JSON Schema'
  },
  react: {
    label: 'React - an alternative syntax for propTypes'
  },
  react_debugging: {
    label: 'React - with full debugging support (remember to open up the console)',
    debug: true
  },
  backbone: {
    label: 'Backbone - `validate()` implementation'
  },
  backbone_debugging: {
    label: 'Backbone - with full debugging support (remember to open up the console)',
    debug: true
  }
};

var examples = {};
var options = [];
Object.keys(scripts).forEach(function (id) {
  examples[id] = $('#' + id).text();
  options.push(<option key={id} value={id}>{scripts[id].label}</option>);
});
var defaultExample = 'primitives';

//
// makes all types global
//

[
  'Nil',
  'Str',
  'Num',
  'Bool',
  'Func',
  'Re',
  'Dat',
  'maybe',
  'struct',
  'union',
  'subtype',
  'list',
  'tuple',
  'enums',
  'dict'
]
.forEach(function (name) {
  window[name] = t[name];
});

var results = [];
window.validate = function (value, type, opts) {
  var result = v(value, type, opts);
  console.log(result);
  results.push(result);
  return result;
};

//
// components
//

var Header = React.createClass({
  render: function () {
    return (
      <Row className="header">
        <Col md={6}>
          <h1>{repo('tcomb-validation')} playground</h1>
          <p className="text-muted">A JavaScript validation library based on type combinators</p>
          <br/>
          <p>
            Concise yet expressive syntax, full debugging support, seamless integration with React and Backbone.
          </p>
        </Col>
        <Col md={6}>
          <div className="text-right repo-link">
              <p>My <a href="/">blog</a></p>
          </div>
        </Col>
      </Row>
    );
  }
});

var Footer = React.createClass({
  render: function () {
    return (
      <Row className="text-muted">
        <Col md={1}>
          <strong>Credits:</strong>
        </Col>
        <Col md={11}>
          <ul>
            <li>{repo('tcomb-validation')} <i>"General purpose validation library for JavaScript"</i></li>
            <li>{repo('tcomb')} <i>"Pragmatic runtime type checking for JavaScript "</i></li>
            <li><a href="http://facebook.github.io/react/index.html">React.js</a></li>
            <li><a href="http://backbonejs.org">Backbone.js</a></li>
          </ul>
        </Col>
      </Row>
    );
  }
});

var Example = React.createClass({
  onChange: function () {
    var value = this.refs.example.getValue();
    this.props.onChange(value);
  },
  render: function () {
    return (
      <Input ref="example" type="select" value={this.props.name} onChange={this.onChange}>
        {options}
      </Input>
    );
  }
});

var Validation = React.createClass({
  render: function () {
    var results = this.props.results;
    var validation;
    if (results instanceof Error) {
      validation = (
        <Alert bsStyle="danger">
          {results.message}
        </Alert>
      );
    } else {
      validation = results.map(function (result) {
        if (result.isValid()) {
          return (
            <Alert bsStyle="success">
              ok
            </Alert>
          );
        } else {
          return result.errors.map(function (e, i) {
            return (
              <Alert bsStyle="danger">
                {e.message}
              </Alert>
            );
          });
        }
      });
    }
    return (
      <div>{validation}</div>
    );
  }
});

var CodeMirrorComponent = React.createClass({

    updateCode: function(){
      this.cm.setValue(this.props.code);
    },

    codeChanged: function(cm){
      // set a flag so this doesn't cause a cm.setValue
      this.userChangedCode = true;
      this.props.onChange && this.props.onChange(cm.getValue());
    },

    // standard lifecycle methods
    componentDidMount: function() {
      // bind CodeMirror
      this.cm = CodeMirror(this.getDOMNode(), {
        mode: 'javascript',
        lineNumbers: false,
        lineWrapping: true,
        smartIndent: false  // javascript mode does bad things with jsx indents
      });
      this.updateCode();
      this.cm.on("change", this.codeChanged);
    },

    componentDidUpdate: function(){
      this.updateCode();
    },

    componentWillUnmount: function(){
      this.cm.off("change", this.codeChanged);
    },

    render: function() {
      return (<div />);
    },

    shouldComponentUpdate: function(nextProps){
      if (this.userChangedCode) {
        this.userChangedCode = false;
        return false;
      }
      return nextProps.code !== this.props.code;
    }
});

var Main = React.createClass({
  getInitialState: function () {
    return {
      code: examples[defaultExample],
      name: defaultExample
    };
  },
  eval: function (code) {
    results = [];
    try {
      var js = JSXTransformer.transform(code).code;
      return eval(js);
    } catch (e) {
      return e;
    }
  },
  onExampleChange: function (name) {
    var code = examples[name];
    isDebuggerEnabled = !!scripts[name].debug;
    this.setState({code: code, name: name});
  },
  onCodeChange: function (code) {
    this.setState({code: code, name: this.state.name});
  },
  render: function () {
    var code = this.state.code;
    var err = this.eval(code);
    return (
      <Grid>
        <Header/>
        <Row>
          <Col md={6}>
            <p className="lead">Choose a code example, or write your own</p>
            <Example name={this.state.name} onChange={this.onExampleChange}/>
            <p className="text-muted">Open up the console for a complete debugging experience..</p>
            <CodeMirrorComponent code={this.state.code} onChange={this.onCodeChange}/>
          </Col>
          <Col md={6}>
            { this.state.name === 'form' ? 
              <div>
                <p className="lead">Form</p>
                <form id="myform" role="form" method="post">
                  <div className="form-group">
                    <input type="text" id="username" placeholder="Username" className="form-control"/>
                  </div>
                  <div className="form-group">
                    <input type="password" id="password" placeholder="Password" className="form-control"/>
                  </div>
                  <button className="btn btn-primary btn-block">Sign in</button>
                </form>                
              </div>
              : 
              <div>
                <p className="lead">Validation result</p>
                <Validation results={err instanceof Error ? err : results}/>
              </div>
            }
          </Col>
        </Row>
        <hr/>
        <Footer/>
      </Grid>
    );
  }
});

//
// run
//

var main = React.renderComponent(Main(null), document.getElementById('app'));


});

