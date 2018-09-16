import './AMILoader.workerEnv'
import { VolumeLoader } from "ami.js";
import JSZip from "jszip";
import axios from "axios";
// console.log(self.nodeRequire, THREE, new VolumeLoader())

var loader;

function loadWithUrls(links) {
  var fileType = null;
  if (typeof links === "string") {
    var array = links.split(".");
    fileType = array[array.length - 1].toLowerCase();
  }

  return new Promise((resolve, reject) => {
    if (fileType === "zip") {
      axios
        .get(links, {
          responseType: "blob",
          onDownloadProgress: e =>
            self.postMessage({
              type: "downloading",
              value: { loaded: e.loaded, total: e.total }
            })
        })
        .then(res => {
          self.postMessage({ type: "parseBegin" });
          return Promise.resolve(res.data);
        })
        .then(JSZip.loadAsync)
        .then(zip => {
          // console.log(zip, loader);
          let seriesContainer = [];
          let fileArray = Object.keys(zip.files);
          let fileArrayLength = fileArray.length;
          fileArray.forEach(item => {
            zip
              .file(item)
              .async("arraybuffer")
              .then(buffer => loader.parse({ url: item, buffer }))
              .then(series => {
                seriesContainer.push(series);
                let seriesContainerLength = seriesContainer.length;
                self.postMessage({
                  type: "parsing",
                  value: {
                    parsed: seriesContainerLength,
                    total: fileArrayLength
                  }
                });
                if (seriesContainerLength >= fileArrayLength) {
                  resolve(seriesContainer[0].mergeSeries(seriesContainer)[0]);
                  loader = null;
                }
              })
              .catch(e => reject(e));
          });
        })
        .catch(e => reject(e));
    } else {
      loader
        .load(links)
        .then(() => {
          resolve(loader.data[0].mergeSeries(loader.data)[0]);
          loader = null;
        })
        .catch(e => reject(e));
    }
  });
}

// It's only working under electron
function loadWithPaths(links) {
  let fs, osPath;
  try {
    fs = self.nodeRequire("fs");
    osPath = self.nodeRequire("path");
  } catch (e) {
    return Promise.reject(new Error("环境错误:" + e));
  }

  var fileType = null;
  if (typeof links === "string") {
    var array = links.split(".");
    fileType = array[array.length - 1].toLowerCase();
  }

  return new Promise((resolve, reject) => {
    if (fileType === "zip") reject(new Error("暂不支持加载zip"));
    self.postMessage({ type: "parseBegin" });

    if (typeof links === "string") {
      if (fs.statSync(links).isDirectory()) {
        let path = links;
        links = fs.readdirSync(links);
        links.forEach((k, i, a) => {
          a[i] = osPath.join(path, k);
        });
      } else {
        links = [links];
      }
    }
    let seriesContainer = [];
    let linksLength = links.length;
    links.forEach(k => {
      fs.readFile(k, (e, data) => {
        if (e) reject(new Error("读取Dicom数据错误,k:" + k + ",e:" + e));
        loader.parse({ url: k, buffer: data }).then(series => {
          seriesContainer.push(series);
          let seriesContainerLength = seriesContainer.length;
          self.postMessage({
            type: "parsing",
            value: { parsed: seriesContainerLength, total: linksLength }
          });
          if (seriesContainerLength >= linksLength) {
            // console.log(seriesContainer[0].mergeSeries(seriesContainer)[0])
            resolve(seriesContainer[0].mergeSeries(seriesContainer)[0]);
            loader = null;
          }
        });
      });
    });
  });
}

self.onmessage = ({ data }) => {
  if (data.type !== "urls" && data.type !== "paths") {
    self.postMessage({ type: "error", value: "数据源类型错误" });
    return;
  }

  loader = new VolumeLoader(false, () => {
    return {
      update: (v, t, mode) => {
        if (mode === "load") {
          self.postMessage({
            type: "downloading",
            value: { loaded: v, total: t }
          });
          if (v / t === 1) self.postMessage({ type: "parseBegin" });
        } else {
          self.postMessage({ type: "parsing", value: { loaded: v, total: t } });
        }
      }
    };
  });

  let promise;
  if (data.type === "urls") promise = loadWithUrls(data.links);
  else promise = loadWithPaths(data.links);

  promise
    .then(value => {
      value._stack.forEach(i => {
        i.prepare();
        i.pack();
      });

      let transferList = [];
      value._stack.forEach(i => {
        i._rawData.forEach(o => {
          if (!transferList.includes(o.buffer)) transferList.push(o.buffer);
        });
        i._frame.forEach(o => {
          if (!transferList.includes(o._pixelData.buffer))
            transferList.push(o._pixelData.buffer);
        });
      });

      // console.log(value, transferList, transferList[1] === transferList[2])
      self.postMessage({ type: "result", value }, transferList);
    })
    .catch(e => self.postMessage({ type: "error", value: e.stack }));
};
