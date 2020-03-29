'use strict';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';
const uuid = require('uuid').v4;

// TODO maybe switch from FontLoader to the new CSS font loader api?
// though probably the browser suport is worse
//  https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API
// Maybe use this: https://github.com/bramstein/fontfaceobserver
import FontLoader from 'FontLoader';

var LabelMaker = require('../labelmaker.js');
var settings = require('../../../settings.web.js');

module.exports = class Print extends Component {
   
    constructor(props) {
      super(props);
      
      this.modalCallback = props.callback;
      this.submitForm = this.submitForm.bind(this)

      this.state = Object.assign({
        id: props.item.id || uuid(),
        title: undefined,
        text: undefined,
        bsl: 1,
        temperature: undefined
      }, props.item.label || {
        title: props.item.name,
        text: props.item.description
      })

      this.keepScanning = true;
      this.enableDM = false;

      this.labelMaker = new LabelMaker({
        symbolPath: settings.symbolPath,
        lineMargins: {
          2: 15
        }
      });

      var fontLoader = new FontLoader(["FiraSans-Regular", "FiraSans-Bold", "FiraSans-Italic"], {
        complete: function(err) {
          if(err) {
            app.actions.notify("Some required fonts failed to load", 'error', 0);
            console.error("Font load failure:", err);
            return;
          }
          // for some reason we need to wait for next tick
          // otherwise the fonts aren't actually available yet
          setTimeout(function() {
            this.setState({
              fontsLoaded: true
            });
          }.bind(this), 1);
        }.bind(this)
      }, 3000);
      fontLoader.loadFonts();
    }
      
    componentWillReceiveProps(nextProps) {

      if(nextProps.item) {
        this.setState(nextProps.item.label || {
          title: nextProps.item.name,
          text: nextProps.item.description
        });
      }

    }

    updateLabel(cb) {
      cb = cb || function() {}

      var pre = ""
      pre += (this.state.id || '?') + "\n";
      pre += (this.state.title || '') + "\n";
      
      var txt = this.state.text || '';
      var temperature = this.state.temperature || '';
      
      var o = {
        temperature: temperature,
        bsl: this.state.bsl || 1
      };
      
      if (o.bsl > 1) {
        o.biohazard = true;
      }
      
      this.labelMaker.drawLabel('labelPreview', this.state.id, pre + txt, o, cb);
    }


    submitForm(e) {
      e.preventDefault()
      if(!this.modalCallback) return;
      console.log('print label submit');
      var imageData = this.labelMaker.getDataURL();
      this.modalCallback(null, this.state, imageData);
        // TODO fixme
//        app.actions.prompt.reset()
    }
      
    close(e) {
      if (this.props.onClose) this.props.onClose(false)
      // TODO fixme
//        app.actions.prompt.reset()
    }


    componentDidMount() {
      this.componentDidUpdate();
    }


    componentDidUpdate() {
      if(!this.state.fontsLoaded) return;
      this.updateLabel(function(err) {
        if(err) app.actions.notify(err, 'error');
      });
    }

	  render() {

        const linkFormData = function(component, fid, valuePath) {
          return event => {
            var update = {};
            update[fid] = event.currentTarget.value;
            //this.setState(update)
            Object.assign(this.state, update)
            this.updateLabel()
          };
        }.bind(this)
        
        const FormInputText = function(props) {
            return (
                <div class="field">
                    <label class="label">{props.label}</label>
                    <div class="control has-icons-left has-icons-right">
                        <input class="input" style="padding-left: 0.75em;" type="text" placeholder={props.label} oninput={linkFormData(this, props.fid)} value={props.value} readonly={props.readonly}/>
                    </div>
                </div>
            )
        }
        const FormInputTextArea = function(props) {
            return (
                <div class="field">
                    <label class="label">{props.label}</label>
                    <div class="control has-icons-left has-icons-right">
                        <textarea class="input" style="padding-left: 0.75em;" type="text" placeholder={props.label} oninput={linkFormData(this, props.fid)} value={props.value} readonly={props.readonly}/>
                    </div>
                </div>
            )
        }

        return (
            <div class="tile">
                <div class="tile" style="margin-left:20px;">
                    <form id="createLabelForm" name="createLabelForm" onsubmit={this.submitForm.bind(this)}>
                        <input type="hidden" value={this.state.id || '?'} /><br/>
                        <FormInputText fid='title' value={this.state.title} label="Title" />
                        <FormInputTextArea fid='text' value={this.state.text} label="Additional text" />
                        <FormInputText fid='temperature' value={this.state.temperature} label="Storage Temperature" />
                        <FormInputText fid='bsl' value={this.state.bsl} label="Biosafety Level" />
                        <input type="submit" style="visibility:hidden;height:0" />
                        <div class="field">
                            <div class="control">
                                <input type="submit" class="button is-link" value="Save & print" />
                                <span style="margin-right:20px;">&nbsp;</span>
                                <input type="button" class="button is-link" value="Cancel" onclick={this.close.bind(this)} />
                            </div>
                        </div>
                    </form>
                </div>
                <div class="tile is-vertical">
                    <div style="width:560px;height:174px;">
                        <canvas id="labelPreview" class="labelPreview tab" width="560" height="174"></canvas>
                    </div>
                </div>
            </div>
        )
    }
  }
