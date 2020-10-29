
'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';
const LabContainer = require('./lab_container.js');

class Test extends Component {

  constructor(props) {
    super(props);

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

  btnClick() {
    console.log("CLICK");
    app.actions.ligoCreateOrder({
//      "firstName": "LIMS TEST 2",
//      "lastName": "Test 2",
      //      "sampleCollectionTime": 1603795483
      "firstName":"firstName13",
      "lastName":"lastName13",
      "sampleCollectionTime": 1593374500
    }, (err, data) => {
      if(err) {
        console.error("Got error:", err);
        return;
      }
      console.log("Got:", data);
    });
  }
  
  render() {
    
    return (
      <Container>
        <input type="button" onClick={this.btnClick.bind(this)} value="Create order" />
      </Container>
    );
  }
}


module.exports = view(Test);
  
