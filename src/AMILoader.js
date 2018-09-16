import { VolumeLoader } from "ami.js/src/ami.js";
import JSZip from "jszip";
import axios from "axios";

export default class AMILoader {
  /**
   * @param {Element} threeD AppDOM
   * @param {Function} downloadingFn 下载期间回调
   * @param {Function} parseBeginFn 下载完毕，开始解析回调
   */
  constructor(
    threeD = false,
    downloadingFn = (loaded, total) => {},
    parseBeginFn = () => {}
  ) {
    this.downloadingFn = downloadingFn;
    this.parseBeginFn = parseBeginFn;
    this.loader = new VolumeLoader(threeD, () => {
      return {
        update: (v, t, mode) => {
          if (mode === "load") {
            this.downloadingFn(v, t);
            if (v / t === 1) this.parseBeginFn();
          }
        }
      };
    });
  }

  /**
   * @return Promise.resolve(series)
   * @param {String} type 数据源类型( 'urls' | 'paths' )
   * @param {String|Array<String>} links 文件链接( url | path )
   */
  load(type = "urls", links) {
    return type === "urls"
      ? this.loadWithUrls(links)
      : this.loadWithPaths(links);
  }

  loadWithUrls(links) {
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
            onDownloadProgress: e => this.downloadingFn(e.loaded, e.total)
          })
          .then(res => {
            this.parseBeginFn();
            return Promise.resolve(res.data);
          })
          .then(JSZip.loadAsync)
          .then(zip => {
            // console.log(zip, loader);
            let seriesContainer = [];
            let fileArray = Object.keys(zip.files);
            fileArray.forEach(item => {
              zip
                .file(item)
                .async("arraybuffer")
                .then(buffer => this.loader.parse({ url: item, buffer }))
                .then(series => seriesContainer.push(series))
                .then(() => {
                  if (seriesContainer.length >= fileArray.length) {
                    let series = seriesContainer[0].mergeSeries(
                      seriesContainer
                    )[0];
                    series._stack.forEach(i => {
                      i.prepare();
                      i.pack();
                    });
                    resolve(series);
                    this.loader = null;
                  }
                })
                .catch(e => reject(e));
            });
          })
          .catch(e => reject(e));
      } else {
        this.loader
          .load(links)
          .then(() => {
            resolve(this.loader.data[0].mergeSeries(this.loader.data)[0]);
            this.loader = null;
          })
          .catch(e => reject(e));
      }
    });
  }

  // It's only working under electron
  loadWithPaths(links) {
    let fs, osPath;
    try {
      fs = window.nodeRequire("fs");
      osPath = window.nodeRequire("path");
    } catch (e) {
      return window.alert("环境错误:" + e);
    }

    var fileType = null;
    if (typeof links === "string") {
      var array = links.split(".");
      fileType = array[array.length - 1].toLowerCase();
    }

    return new Promise((resolve, reject) => {
      if (fileType === "zip") reject(new Error("暂不支持加载zip"));
      this.parseBeginFn();
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
      links.forEach(k => {
        fs.readFile(k, (e, data) => {
          if (e) reject(new Error("读取Dicom数据错误,k:" + k + ",e:" + e));
          this.loader
            .parse({ url: k, buffer: data })
            .then(series => seriesContainer.push(series))
            .then(() => {
              if (seriesContainer.length >= links.length) {
                // console.log(seriesContainer[0].mergeSeries(seriesContainer)[0])
                let series = seriesContainer[0].mergeSeries(seriesContainer)[0];
                series._stack.forEach(i => {
                  i.prepare();
                  i.pack();
                });
                resolve(series);
                this.loader = null;
              }
            });
        });
      });
    });
  }
}
