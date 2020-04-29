'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';
import Akima from 'akima-interpolator';

class Plot extends Component {

  constructor(props) {
    super(props);
    
    this.state = Object.assign({
      interpolateMode: 'akima',
      pointRadius: 2,
      xAxis: Object.assign({
        show: true, // draw the actual x-axis
        align: 'bottom', // or 'top', 'center' or coordinate
        from: Math.min.apply(Math, props.xvals), // start x-coordinate for viewport (auto-scale if undef)
        to: Math.max.apply(Math, props.xvals) // end x-coordinate for viewport (auto-scale if undef)
      }, props.xAxis || {}),
      yAxis: Object.assign({
        show: true,
        align: 'left', // or 'right', 'center' or coordinate
        from: Math.min.apply(Math, props.yvals), // start x-coordinate for viewport (auto-scale if undef)
        to: Math.max.apply(Math, props.yvals) // end x-coordinate for viewport (auto-scale if undef)
      }, props.yAxis || {}),
      margin: {top: 0, right: 0, bottom: 30, left: 60}
    }, props || {});
    
  }
  
  interpolate(xvals, yvals, interpolateMode) {

    var interpolated = [];
    
    if(interpolateMode === 'akima') {
      var akima = new Akima();
      var f = akima.createInterpolator(xvals, yvals);

      var i, p1, p2, fI;
      var prevY;
      for(i=0; i < xvals[xvals.length - 1]; i++) {
        if(prevY) {
          fI = f(i);
          p1 = this.translateToScreen(i - 1, prevY);
          p2 = this.translateToScreen(i, fI);
          
          if(p1.outOfFrame && p2.outOfFrame) {
            prevY = fI;
            continue;
          }
          interpolated.push((
              <line class="interpolated" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
          ));
          prevY = fI;
        } else {
          prevY = f(i);
        }
      }
    } else if(interpolateMode === 'lines') {

      var i, p1, p2;
      for(i=0; i < xvals.length; i++) {
        if(i > 0) {
          p1 = this.translateToScreen(xvals[i-1], yvals[i-1]);
          p2 = this.translateToScreen(xvals[i], yvals[i]);
          
          if(p1.outOfFrame && p2.outOfFrame) continue;
          
          interpolated.push((
              <line class="interpolated" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
          ));
        }

      }
    }
    return interpolated;
  }

  drawMargins() {
    var els = [];
    
    if(this.state.margin.top) {
      els.push((
        <rect class="margin" x="0" y="0" height={this.state.margin.top} width={this.state.width} />
      ));
    }
    if(this.state.margin.right) {
      els.push((
          <rect class="margin" x={this.state.width - this.state.margin.right} y="0" height={this.state.height} width={this.state.margin.right} />
      ));
    }
    if(this.state.margin.bottom) {
      els.push((
          <rect class="margin" x="0" y={this.state.height - this.state.margin.bottom} height={this.state.margin.bottom} width={this.state.width} />
      ));
    }
    if(this.state.margin.left) {
      els.push((
        <rect class="margin" x="0" y="0" height={this.state.height} width={this.state.margin.left} />
      ));
    }
    return els;
  }

  drawXAxis(props) {
    var els = [];
    props = props || {};
    props.offset = props.offset || 30;
    props.tickLength = props.tickLength || 10;
    props.labelEvery = props.labelEvery || 1; // label every n tick
    props.labelDecimals = props.labelDecimals || 2;

    if(props.tickEvery) {
      props.tickCount = 0;
    } else {
      props.tickCount = props.tickCount || 10;
      props.tickEvery = Math.round((this.state.xAxis.to - this.state.xAxis.from) / props.tickCount);
    }

    var y;
    if(this.state.xAxis.align === 'bottom') {
      y = this.state.height - props.offset;
    } else if(this.state.xAxis.align === 'top') {
      y = props.offset;
    } else { // center
      y = this.state.height / 2;
    }
    
    els.push((
        <line class="axis x-axis" shape-rendering="crispEdges" x1="0" y1={y} x2={this.state.width} y2={y} />
    ));

    var count = 1;
    var p = {};
    var x = this.state.xAxis.from + props.tickEvery;
    while(!p.outOfFrame && count < props.tickCount) {
      p = this.translateToScreenX(x);
      x += props.tickEvery;
      els.push((
          <line class="axis-tick x-axis-tick" x1={p.x} y1={y - props.tickLength / 2} x2={p.x} y2={y + props.tickLength / 2} />
      ));
      if(props.labelEvery && !(count % props.labelEvery )) {
        els.push((
            <text class="axis-label x-axis-label" shape-rendering="crispEdges" x={p.x} y={y + props.tickLength / 2 + 3} text-anchor="middle" dominant-baseline="hanging">{Math.round(x * 100) / 100}</text>
        ));
      }
      count++;
    }
    
    return els;
  }

  drawYAxis(props) {
    var els = [];
    props = props || {};
    props.offset = props.offset || 60;
    props.tickLength = props.tickLength || 10;
    props.labelEvery = props.labelEvery || 1; // label every n tick
    props.labelDecimals = props.labelDecimals || 2;
    
    if(props.tickEvery) {
      props.tickCount = 0;
    } else {
      props.tickCount = props.tickCount || 10;
      props.tickEvery = Math.round((this.state.yAxis.to - this.state.yAxis.from) / props.tickCount);
    }
    
    var x;
    if(this.state.yAxis.align === 'left') {
      x = props.offset;
    } else if(this.state.yAxis.align === 'right') {
      x = this.state.width - props.offset;
    } else { // center
      x = this.state.width / 2;
    }
    
    els.push((
        <line class="axis y-axis" shape-rendering="crispEdges" x1={x} y1="0" x2={x} y2={this.state.height} />
    ));

    var count = 1;
    var p = {};
    var y = this.state.yAxis.from + props.tickEvery;
    while(!p.outOfFrame && count < props.tickCount) {
      p = this.translateToScreenY(y);
      y += props.tickEvery;
      els.push((
          <line class="axis-tick y-axis-tick" shape-rendering="crispEdges" x1={x - props.tickLength / 2} y1={p.y} x2={x + props.tickLength / 2} y2={p.y} />
      ));
      if(props.labelEvery && !(count % props.labelEvery )) {
        els.push((
            <text class="axis-label y-axis-label" x={x - props.tickLength / 2 - 3} y={p.y} text-anchor="end" dominant-baseline="middle">{Math.round(y * 100) / 100}</text>
        ));
      }
      count++;
    }
    
    
    return els;
  }

  drawAxes(xAxisProps, yAxisProps) {
    var els = this.drawXAxis(xAxisProps);
    return els.concat(this.drawYAxis(yAxisProps));
  }

  translateToScreenX(x) {
    var retX;
    // TODO don't recalculate this on every funcion run
    var width = this.state.width - this.state.margin.left - this.state.margin.right
    
    var factorX = width / (this.state.xAxis.to - this.state.xAxis.from);
    retX = (x - this.state.xAxis.from) * factorX + this.state.margin.left;

    var ret = {x: retX}
    
    // TODO for lines this should really check if the line intersects the viewport
    if(retX > this.state.width - this.state.margin.right || retX < this.state.margin.left) {
      ret.outOfFrame = true;
    }
    return ret;
  }
  
  // translate from coordinate to position within SVG given current viewport
  translateToScreenY(y) {
    var retY;
    // TODO don't recalculate this on every funcion run
    var height = this.state.height - this.state.margin.bottom - this.state.margin.top;
    
    var factorY = height / (this.state.yAxis.to - this.state.yAxis.from);
    retY = height - (y - this.state.yAxis.from) * factorY + this.state.margin.top;

    var ret = {y: retY};

    // TODO for lines this should really check if the line intersects the viewport
    if(retY > this.state.height - this.state.margin.bottom || retY < this.state.margin.top) {
      ret.outOfFrame = true;
    }
    
    return ret;
  }

  translateToScreen(x, y) {
    var x = this.translateToScreenX(x);
    var y = this.translateToScreenY(y);
    return {
      x: x.x,
      y: y.y,
      outOfFrame: x.outOfFrame || y.outOfFrame
    }
  }

  render(props, state) {
    var i;

    var axes = this.drawAxes();
    var margins = this.drawMargins();
    
    var points = [];
    
    if(this.state.pointRadius) {
      var p;
      for(i=0; i < this.state.xvals.length; i++) {
        p = this.translateToScreen(this.state.xvals[i], this.state.yvals[i]);
        if(p.outOfFrame) continue;
        points.push((
            <circle class="point" cx={p.x} cy={p.y} r={this.state.pointRadius} />
        ));
      }
    }

    var interpolated = this.interpolate(this.state.xvals, this.state.yvals, this.props.interpolateMode);
    
    return (
        <svg class="xy-plot-min" width={this.state.width} height={this.state.height} shape-rendering="geometricPrecision">
        {interpolated}
      {points}
      {margins}
      {axes}
      </svg>
    );

  }
}

module.exports = view(Plot);
  

