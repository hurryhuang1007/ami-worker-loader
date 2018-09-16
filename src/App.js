import React, { Component } from 'react';
import AMILoaderWorker from "./AMILoader.worker/Index";
import AMILoader from './AMILoader'

class App extends Component {
  state = {
    number: 0,
    text: null
  };

  componentDidMount() {
    this.increaseNumber();
  }

  increaseNumber() {
    this.setState({ number: this.state.number + 1 });
    requestAnimationFrame(() => this.increaseNumber());
  }

  loadWithWorker() {
    this.setState({ text: 'begin test' })
    new AMILoaderWorker(
      () => this.setState({ text: "done" }),
      e => this.setState({ text: "error" + e }),
      true,
      (loaded, total) => this.setState({ text: `downloading:(${loaded}/${total})` }),
      () => this.setState({ text: "begin parse" }),
      (parsed, total) => this.setState({ text: `parsing:(${parsed}/${total}), with HIGH FPS!` })
    ).load(
      "urls",
      "https://raw.githubusercontent.com/hurryhuang1007/myfiles/master/CT.zip"
    );
  }

  loadWithoutWorker() {
    this.setState({ text: 'begin test' })
    new AMILoader(
      false,
      (loaded, total) => this.setState({ text: `downloading:(${loaded}/${total})` }),
      () => this.setState({ text: "begin parse, with LOW FPS!" })
    ).load(
      "urls",
      "https://raw.githubusercontent.com/hurryhuang1007/myfiles/master/CT.zip"
    ).then(
      () => this.setState({ text: "done" })
    ).catch(
      e => this.setState({ text: "error" + e })
    )
  }

  render() {
    return (
      <div>
        <p style={{ position: "fixed", top: 0, left: this.state.number % window.innerWidth }}>
          {this.state.number + (this.state.number % 60 > 30 ? ' o.O?!' : ' Look me!')}
        </p>
        <div
          style={{
            position: "fixed",
            top: 50,
            right: 10,
            display: this.state.text ? "none" : false
          }}
        >
          <button onClick={() => this.loadWithWorker()}>
            load zip with worker
          </button>
          &nbsp;&nbsp;
          <button onClick={() => this.loadWithoutWorker()}>
            load zip without worker
          </button>
        </div>
        <h1 style={{ textAlign: "center", lineHeight: 10 }}>
          {this.state.text}
        </h1>
      </div>
    );
  }
}

export default App;
