'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const rowNames = []; // populated with 'A', 'B', 'C' ...
for(let i=65; i <= 90; i++) {
  rowNames.push(String.fromCharCode(i));
}

function findNextFreeWell(rows, cols, occupied) {
  var r, c, key;

  for(r=1; r <= rows; r++) {
    for(c=1; c <= cols; c++) {
      key = rowNames[r-1]+c.toString();
      if(!occupied[key]) return key;
    }
  }
  return null;
}

function wellElementFromEvent(event) {
  var el = event.target;
  if(!el) return;
  while(!el.classList.contains('col')) {
    if(!el.parentNode) return null;
    el = el.parentNode;
  }
  return el;
}

function wellFromEvent(event) {
  const el = wellElementFromEvent(event);
  if(!el) return null;
  const well = el.getAttribute('data-well');
  if(!well.match(/^[A-Z]\d\d?$/)) return null;
  return well;
}

function wellsToClass(wells, className) {
  var wellsCopy = {};
  for(let well in wells) {
    if(wells[well]) {
      wellsCopy[well] = className;
    }
  }
  return wellsCopy;
}

class Plate extends Component {

  constructor(props) {
    super(props);

    // props.selected format:
    // {
    //   A3: <id>,
    //   B5: <id>
    // }
  }

  componentDidUpdate(prevProps) {
    console.log("update");
    /*
    prevProps = prevProps || {}

    
    this.setState(firstState);
    */
  }
  
  componentDidMount() {
    console.log("mount");
//    this.componentDidUpdate();
  }
  
  makeRow(l, inner) {
    inner = inner || '';
    if(!l) {
      return (
        <div class="hrow header">
            {inner}
        </div>
      );
    } else {
      const className = 'row row-'+l;
      return (
          <div class={className}>
          {inner}
        </div>
      );
    }
  }

  selectWell(well) {
    if(this.props.onSelect) {
      this.props.onSelect(well);
    }
  }
  
  selectWellClick(event) {
    if(!this.props.allowSelectEmpty) return;
    const well = wellFromEvent(event);
    if(!well) return;
    if(this.props.occupied[well]) return;
    this.selectWell(well);
  }

  hoverWell(event) {
    const well = wellFromEvent(event);
    if(!well) return;

    if(this.props.onhover) {
      this.props.onhover(well);
    }
  }
  
  makeColumn(col, row, occupied, occupiedClass, selectedWell, selectedReplicateGroup) {
    var inner;
    const rowName = rowNames[row-1];
    const well = (rowName || '')+col.toString()
    var number = '';
    
    if(!row) {
      if(!col) {
        inner = '';
      } else {
        inner = col.toString();
      }
    } else {
      if(!col) {
        return (
            <div class="hcol">{rowName}</div>
        )
      }
      var dotClass = 'dot';
      var occupiedWell;
      if(rowName) {
        if(selectedWell === well) {
          dotClass += ' selected';
          number = selectedReplicateGroup || '';
        } else {
          occupiedWell = occupiedClass[well];
          if(occupiedWell) {
            dotClass += ' occupied';
            if(occupied[well].special === 'positiveControl') {
              dotClass += ' pos-ctrl';
            } else if(occupied[well].special === 'negativeControl') {
              dotClass += ' neg-ctrl';
            }
            number = occupied[well].replicateGroup || '';
          }
        }
      }
      inner = (
          <div class={dotClass}><div style="display:absolute;top:0;height:0">{number.toString()}</div></div>
      )
    }
    var className = 'col col-'+col;

    return (
        <div class={className} data-well={well} onClick={this.selectWellClick.bind(this)} onMouseOver={this.hoverWell.bind(this)}>{inner}</div>
    );
  }

  
  render() {
    
    const occupiedClass = (this.props.occupied) ? wellsToClass(this.props.occupied, 'green') : {};
    
    const numRows = this.props.rows || 8;
    const numCols = this.props.cols || 12;

    var nextFreeWell;
    var selectedWell;
    if(this.props.selectedWell) {
      
      selectedWell = this.props.selectedWell;
      
    } else if(this.props.selectFree) {
      
      selectedWell = findNextFreeWell(numRows, numCols, occupiedClass);
      
      if(selectedWell) {
        if(this.props.onSelect) {
          this.props.onSelect(selectedWell);
        }
      }
    }
    
    var rows = [];
    var cols;
    var r, c;
    for(r=0; r <= numRows; r++) {
      cols = []
      for(c=0; c <= numCols; c++) {
        cols.push(
          this.makeColumn(c, r, this.props.occupied, occupiedClass, selectedWell, this.props.selectedReplicateGroup)
        );
      }
      rows.push(this.makeRow(r, cols));
    }

    var saveHtml;
    if(selectedWell) {
      saveHtml = (
        <div>
          <button onClick={this.props.onSave || function(){}}>Save sample to well {selectedWell || ''}</button>
          <button onClick={this.props.onCancel || function(){}}>Cancel</button>
          </div>
      );
    } else {
      saveHtml = (
          <p>Click an emptry well to move sample or save to proceed next sample.</p>
      )
    }
    
    return (
      <div>
      <div id="my-plate" class="plate">
        {rows}
      </div>
        {saveHtml}
        </div>
    );
  }
}


module.exports = view(Plate);
  
