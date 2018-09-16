import React, { Component } from 'react';
import AMILoaderWorker from "./AMILoader.worker/Index";

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
    new AMILoaderWorker(
      () => this.setState({ text: "done" }),
      e => this.setState({ text: "error" + e }),
      true,
      (loaded, total) =>
        this.setState({ text: `downloading:(${loaded}/${total})` }),
      () => this.setState({ text: "begin parse" }),
      (parsed, total) => this.setState({ text: `parsing:(${parsed}/${total})` })
    ).load(
      "urls",
      "https://raw.githubusercontent.com/hurryhuang1007/myfiles/master/CT.zip"
    );
  }

  render() {
    return (
      <div>
        <p style={{ position: "fixed", top: 0, left: 8 }}>
          {this.state.number}
        </p>
        <div
          style={{
            position: "fixed",
            top: 12,
            right: 10,
            display: this.state.text ? "none" : false
          }}
        >
          <button onClick={() => this.loadWithWorker()}>
            load zip with worker
          </button>
          &nbsp;&nbsp;
          <button>load zip without worker</button>
        </div>
        <h1 style={{ textAlign: "center", lineHeight: 10 }}>
          {this.state.text}
        </h1>
      </div>
    );
  }
}

export default App;
