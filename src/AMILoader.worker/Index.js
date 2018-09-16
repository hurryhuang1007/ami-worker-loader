import * as THREE from "three";
import WK from "./AMILoader.worker.js";
import { SeriesModel, StackModel, FrameModel } from "ami.js/src/ami.js";

export default class AMILoaderWorker {
  /**
   * @param {Function} resultFn 解析结果回调
   * @param {Function} errorFn 错误回调
   * @param {Boolean} closeWhenLoaded 加载完毕是否关闭worker(可以选择不关闭 在解析结果回调中再次开始解析 以达到重复利用的特性)
   * @param {Function} downloadingFn 下载期间回调
   * @param {Function} parseBeginFn 下载完毕，开始解析回调
   * @param {Function} parsingFn 解析期间回调
   */

  constructor(
    resultFn = result => { },
    errorFn = e => { },
    closeWhenLoaded = true,
    downloadingFn = (loaded, total) => { },
    parseBeginFn = () => { },
    parsingFn = (parsed, total) => { }
  ) {
    this.wk = new WK();
    this.wk.onmessage = ({ data }) => {
      switch (data.type) {
        case "downloading":
          downloadingFn(data.value.loaded, data.value.total);
          break;

        case "parseBegin":
          parseBeginFn();
          break;

        case "parsing":
          parsingFn(data.value.parsed, data.value.total);
          break;

        case "result":
          (() => {
            // console.log(data.value)
            let result = new SeriesModel();

            result._stack = AMILoaderWorker.createStackModel(data.value._stack);
            delete data.value._stack;

            for (let k in data.value) result[k] = data.value[k];
            // console.log(result)
            resultFn(result);
            if (closeWhenLoaded) this.wk.terminate();
          })();
          break;

        case "error":
          errorFn(data.value);
          this.wk.terminate();
          break;
      }
      this.wk.onerror = ({ data }) => {
        errorFn(data);
        this.wk.terminate();
      };
    };
  }

  /**
   * @param {String} type 数据源类型( 'urls' | 'paths' )
   * @param {String|Array<String>} links 文件链接( url | path )
   */
  load(type = "urls", links) {
    this.wk.postMessage({ type, links });
  }

  terminate() {
    this.wk.terminate();
  }

  static createStackModel(data) {
    let result = [];
    data.forEach(i => {
      let stack = new StackModel();
      stack._aabb2LPS = new THREE.Matrix4();
      stack._dimensionsIJK = new THREE.Vector3();
      stack._halfDimensionsIJK = new THREE.Vector3();
      stack._ijk2LPS = new THREE.Matrix4();
      stack._lps2AABB = new THREE.Matrix4();
      stack._lps2IJK = new THREE.Matrix4();
      stack._origin = new THREE.Vector3();
      stack._regMatrix = new THREE.Matrix4();
      stack._spacing = new THREE.Vector3();
      stack._xCosine = new THREE.Vector3();
      stack._yCosine = new THREE.Vector3();
      stack._zCosine = new THREE.Vector3();

      stack._frame = AMILoaderWorker.createFrameModel(i._frame);
      delete i._frame;
      stack._rawDataFromOtherStack = i._rawDataFromOtherStack;
      delete i._rawDataFromOtherStack;

      for (let k in i) stack[k] = typeof i[k] === "object" ? AMILoaderWorker.copyObject(stack[k], i[k]) : i[k];
      result.push(stack);
    });
    return result;
  }

  static createFrameModel(data) {
    let result = [];
    data.forEach(i => {
      let item = new FrameModel();
      // for (let k in i) item[k.substring(1, k.length)] = i[k]
      for (let k in i) item[k] = i[k];
      result.push(item);
    });
    return result;
  }

  static copyObject(result, source) {
    for (let k in source) result[k] = source[k];
    return result;
  }
}
