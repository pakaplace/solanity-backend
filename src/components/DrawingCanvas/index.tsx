import React, { useState, useRef, useEffect, useCallback } from 'react';
// import { useHistory } from 'react-router-dom';
import 'antd/dist/antd.css';
import {
  UndoOutlined,
  ClearOutlined,
  PlaySquareOutlined,
  HighlightOutlined,
  BgColorsOutlined,
  BorderOutlined,
  SaveOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  Row,
  Button,
  Input,
  InputNumber,
  Form,
  message,
  Col,
  Slider,
  Space,
  notification,
  Popconfirm,
  Tooltip,
  Popover,
  Table,
} from 'antd';
import { useLocalStorage } from '../../hooks';
import { addToIPFS } from '../../helpers/ipfs';
import CanvasDraw from 'react-canvas-draw';
import {
  SketchPicker,
  CirclePicker,
  TwitterPicker,
  AlphaPicker,
} from 'react-color';
import LZ from 'lz-string';
import { useHotkeys } from 'react-hotkeys-hook';
import Hash from 'ipfs-only-hash';
import { getNft } from '../../helpers/getMetadata';

const pickers = [CirclePicker, TwitterPicker, SketchPicker];
const PLACEHOLDER_COLLECTION_NAME = 'Cards of Solanity';
const DOMAIN_PLACEHOLDER = 'localhost:3000';
const CREATOR_SHARE = 100;

const ipfsConfigInfura = {
  host: 'ipfs.infura.io',
  port: '5001',
  protocol: 'https',
  timeout: 250000,
};

const ipfsConfig = {
  host: 'ipfs.nifty.ink',
  port: '3001',
  protocol: 'https',
  timeout: 250000,
};

export default function DrawingCanvas({
  address = '0x123',
  mode = 'edit',
  mintNft,
  getImage = null,
  canMint = false,
  name = 'Solanity',
}) {
  // let history = useHistory();

  const [picker, setPicker] = useLocalStorage('picker', 0);
  const [color, setColor] = useLocalStorage('color', '#666666');
  const [brushRadius, setBrushRadius] = useState(8);
  const drawingCanvas = useRef(null);
  const [sending, setSending] = useState(false);
  const [initialDrawing, setInitialDrawing] = useState();
  const currentLines = useRef([]);
  const drawnLines = useRef([]);
  const [canvasDisabled, setCanvasDisabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [drawingSize, setDrawingSize] = useState(0);
  const [viewDrawing, setViewDrawing] = useState();
  const [ink, setInk] = useState({});
  const [drawing, setDrawing] = useLocalStorage('drawing');
  const [ipfsHash, setIpfsHash] = useState<string>('');
  const [drawingSaved, setDrawingSaved] = useState(true);
  const portraitRatio = 1.7;
  const [portrait, setPortrait] = useState<boolean>();
  const [size, setSize] = useState(['70vmin', '70vmin']); //["70vmin", "70vmin"]) //["50vmin", "50vmin"][750, 500]

  function debounce(fn, ms) {
    let timer;
    return (_) => {
      clearTimeout(timer);
      timer = setTimeout(function (_) {
        timer = null;
        fn.apply(this, ...arguments);
      }, ms);
    };
  }

  useEffect((): any => {
    const debouncedHandleResize = debounce(function handleResize() {
      const calculatedVmin = Math.min(
        window.document.body.clientHeight,
        window.document.body.clientWidth
      );
      // setSize([0.85 * calculatedVmin, 0.85 * calculatedVmin]);
      // let portraitCalc =
      //   window.document.body.clientWidth / size[0] < portraitRatio;
      //console.log(_portraitCalc?"portrait mode":"landscape mode")
      // setPortrait(portraitCalc);
    }, 500);
    window.addEventListener('resize', debouncedHandleResize);
    return (_) => {
      window.removeEventListener('resize', debouncedHandleResize);
    };
  });

  useEffect(() => {
    getImage.current = async () => {
      setCanvasDisabled(true);
      return await generateNftImage();
    };
  }, [getImage]);

  //Keyboard shortcuts
  useHotkeys('ctrl+z', () => undo());
  useHotkeys(']', () => updateBrushRadius((brushRadius) => brushRadius + 1));
  useHotkeys('shift+]', () =>
    updateBrushRadius((brushRadius) => brushRadius + 10)
  );
  useHotkeys('[', () => updateBrushRadius((brushRadius) => brushRadius - 1));
  useHotkeys('shift+[', () =>
    updateBrushRadius((brushRadius) => brushRadius - 10)
  );
  useHotkeys('.', () => updateOpacity(0.01));
  useHotkeys('shift+.', () => updateOpacity(0.1));
  useHotkeys(',', () => updateOpacity(-0.01));
  useHotkeys('shift+,', () => updateOpacity(-0.1));

  const updateBrushRadius = useCallback((value) => {
    setBrushRadius(value);
  }, []);

  const updateColor = (value) => {
    console.log(value);
    setColor(
      `rgba(${value.rgb.r},${value.rgb.g},${value.rgb.b},${value.rgb.a})`
    );
    console.log(
      `rgba(${value.rgb.r},${value.rgb.g},${value.rgb.b},${value.rgb.a})`
    );
  };

  const updateOpacity = useCallback(
    (value) => {
      let colorPlaceholder = drawingCanvas.current.props.brushColor
        .substring(5)
        .replace(')', '')
        .split(',')
        .map((e) => parseFloat(e));

      if (
        (colorPlaceholder[3] <= 0.01 && value < 0) ||
        (colorPlaceholder[3] <= 0.1 && value < -0.01)
      ) {
        setColor(
          `rgba(${colorPlaceholder[0]},${colorPlaceholder[1]},${
            colorPlaceholder[2]
          },${0})`
        );
      } else if (
        (colorPlaceholder[3] >= 0.99 && value > 0) ||
        (colorPlaceholder[3] >= 0.9 && value > 0.01)
      ) {
        setColor(
          `rgba(${colorPlaceholder[0]},${colorPlaceholder[1]},${
            colorPlaceholder[2]
          },${1})`
        );
      } else {
        setColor(
          `rgba(${colorPlaceholder[0]},${colorPlaceholder[1]},${
            colorPlaceholder[2]
          },${(colorPlaceholder[3] + value).toFixed(2)})`
        );
      }
    },
    [setColor]
  );

  const saveDrawing = (newDrawing, saveOverride) => {
    currentLines.current = newDrawing.lines;
    //if(!loadedLines || newDrawing.lines.length >= loadedLines) {
    if (
      saveOverride ||
      newDrawing.lines.length < 100 ||
      newDrawing.lines.length % 10 === 0
    ) {
      console.log('saving');
      let savedData = LZ.compress(newDrawing.getSaveData());
      setDrawing(savedData);
      setDrawingSaved(true);
    } else {
      setDrawingSaved(false);
    }
    //}
  };

  useEffect(() => {
    if (brushRadius <= 1) {
      setBrushRadius(1);
    } else if (brushRadius >= 100) {
      setBrushRadius(100);
    }
  }, [brushRadius, updateBrushRadius, updateOpacity]);

  useEffect(() => {
    const loadPage = async () => {
      console.log('loadpage');
      if (drawing && drawing !== '') {
        try {
          let decompressed = LZ.decompress(drawing);
          currentLines.current = JSON.parse(decompressed)['lines'];

          let points = 0;
          for (const line of currentLines.current) {
            points = points + line.points.length;
          }
          setDrawingSize(points);
          //setLoadedLines(JSON.parse(decompressed)['lines'].length)
          //console.log(decompressed)
          //drawingCanvas.current.loadSaveData(decompressed, true)
          setInitialDrawing(decompressed);
        } catch (e) {
          console.log(e);
        }
      }
      setLoaded(true);
    };
    (window as any).drawingCanvas = drawingCanvas;
    loadPage();
  }, [drawing]);

  const PickerDisplay = pickers[picker % pickers.length];

  const generateNftImage = async () => {
    let imageData = drawingCanvas.current.canvas.drawing.toDataURL('image/png');
    let imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
    const imageHash = await Hash.of(imageBuffer);
    try {
      let res = await addToIPFS(imageBuffer, ipfsConfig);
      console.log('IPFS RESULT', res, imageHash);
      return imageHash;
    } catch (err) {
      console.error(err);
    }
  };

  const generateNftData = async () => {
    setSending(true);
    let imageData = drawingCanvas.current.canvas.drawing.toDataURL('image/png');
    saveDrawing(drawingCanvas.current, true);
    let compressedArray = LZ.compressToUint8Array(
      drawingCanvas.current.getSaveData()
    );

    let drawingBuffer = Buffer.from(compressedArray);
    let imageBuffer = Buffer.from(imageData.split(',')[1], 'base64');
    const drawingHash = await Hash.of(drawingBuffer);
    const imageHash = await Hash.of(imageBuffer);
    console.log('drawingHash', drawingHash, ' imageHash', imageHash);

    let drawingResultInfura;
    let imageResultInfura;
    let metadataResultInfura;

    const timeInMs = new Date();
    let metadata = {
      name: name,
      symbol: 'STY',
      description: `Created by ${address} on ${timeInMs.toUTCString()}`,
      seller_fee_basis_points: 500,
      image: `https://ipfs.io/ipfs/${imageHash}`,
      animation_url: '',
      external_url: `${DOMAIN_PLACEHOLDER}/${drawingHash}`,
      attributes: [
        //   {
        //     "trait_type": "web",
        //     "value": "yes"
        //   },
      ],
      collection: {
        name,
        family: PLACEHOLDER_COLLECTION_NAME,
      },
      properties: {
        files: [
          {
            uri: `https://ipfs.io/ipfs/${imageHash}?ext=png`,
            type: 'image/png',
          },
          {
            uri: `https://ipfs.io/ipfs/${drawingHash}`,
            type: 'buffer',
          },
        ],
        category: 'image',
        creators: [
          {
            address: address,
            share: CREATOR_SHARE,
          },
        ],
      },
    };
    let metadataJson = JSON.stringify(metadata);
    const metadataBuffer = Buffer.from(metadataJson);
    const jsonHash = await Hash.of(metadataBuffer);
    const imageResult = addToIPFS(imageBuffer, ipfsConfig);
    // Handle IPFS uploads of drawing, image, and metadata
    try {
      const drawingResult = addToIPFS(drawingBuffer, ipfsConfig);
      const imageResult = addToIPFS(imageBuffer, ipfsConfig);
      const metadataJsonResult = addToIPFS(metadataBuffer, ipfsConfig);
      await Promise.all([drawingResult, imageResult, metadataJsonResult]).then(
        (values) => {
          console.log('FINISHED UPLOADING TO IPFS PINNER', values);
          message.destroy();
        }
      );
    } catch (e) {
      console.log(e);
      setSending(false);
      notification.open({
        message: '📛 Ink upload failed',
        description: `Please wait a moment and try again ${e.message}`,
      });
      return;
    }

    // Mint NFT on Solana
    try {
      var mintResult = await mintNft(
        `https://ipfs.io/ipfs/${jsonHash}`,
        metadata.name,
        metadata.symbol,
        metadata.seller_fee_basis_points
      );
      console.log('Mint Results', mintResult);
      setSending(false);
    } catch (e) {
      console.log(e);
      setSending(false);
    }
    // Retry IPFS pinning on Infura if it didn't work
    // if (!!mintResult) {
    //   drawingResultInfura = addToIPFS(drawingBuffer, ipfsConfigInfura);
    //   imageResultInfura = addToIPFS(imageBuffer, ipfsConfigInfura);
    //   metadataResultInfura = addToIPFS(metadataBuffer, ipfsConfigInfura);
    //   Promise.all([
    //     drawingResultInfura,
    //     imageResultInfura,
    //     metadataResultInfura,
    //   ]).then((values) => {
    //     console.log('INFURA FINISHED UPLOADING!', values);
    //   });
    //   setSending(false);
    //   setViewDrawing(drawingCanvas.current.getSaveData()); //LZ.decompress(props.drawing))
    //   setDrawingSize(10000);
    //   setDrawing('');
    //   // history.push('/ink/' + drawingHash);
    // }
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  const triggerOnChange = (lines) => {
    let saved = JSON.stringify({
      lines: lines,
      width: drawingCanvas.current.props.canvasWidth,
      height: drawingCanvas.current.props.canvasHeight,
    });

    drawingCanvas.current.loadSaveData(saved, true);
    //setLoadedLines(lines.length)
    //setInitialDrawing(saved)
    drawingCanvas.current.lines = lines;
    saveDrawing(drawingCanvas.current, true);
  };

  const undo = () => {
    if (!drawingCanvas.current.lines.length) return;

    if (
      drawingCanvas.current.lines[drawingCanvas.current.lines.length - 1].ref
    ) {
      drawingCanvas.current.lines[0].brushColor =
        drawingCanvas.current.lines[
          drawingCanvas.current.lines.length - 1
        ].brushColor;
      let lines = drawingCanvas.current.lines.slice(0, -1);
      triggerOnChange(lines);
    } else {
      let lines = drawingCanvas.current.lines.slice(0, -1);
      triggerOnChange(lines);
    }
  };

  const fillBackground = (color) => {
    let width = drawingCanvas.current.props.canvasWidth;
    let height = drawingCanvas.current.props.canvasHeight;

    let bg = {
      brushColor: color,
      brushRadius: (width + height) / 2,
      points: [
        { x: 0, y: 0 },
        { x: width, y: height },
      ],
      background: true,
    };

    let previousBGColor = drawingCanvas.current.lines.filter((l) => l.ref)
      .length
      ? drawingCanvas.current.lines[0].brushColor
      : '#FFF';

    let bgRef = {
      brushColor: previousBGColor,
      brushRadius: 1,
      points: [
        { x: -1, y: -1 },
        { x: -1, y: -1 },
      ],
      ref: true,
    };

    drawingCanvas.current.lines.filter((l) => l.background).length
      ? drawingCanvas.current.lines.splice(0, 1, bg)
      : drawingCanvas.current.lines.unshift(bg);
    drawingCanvas.current.lines.push(bgRef);

    let lines = drawingCanvas.current.lines;

    triggerOnChange(lines);
  };

  // const drawFrame = (color, radius) => {
  //   let width = drawingCanvas.current.props.canvasWidth;
  //   let height = drawingCanvas.current.props.canvasHeight;

  //   drawingCanvas.current.lines.push({
  //     brushColor: color,
  //     brushRadius: radius,
  //     points: [
  //       { x: 0, y: 0 },
  //       { x: width, y: 0 },
  //       { x: width, y: 0 },
  //       { x: width, y: height },
  //       { x: width, y: height },
  //       { x: 0, y: height },
  //       { x: 0, y: height },
  //       { x: 0, y: 0 },
  //     ],
  //   });

  //   let lines = drawingCanvas.current.lines;

  //   triggerOnChange(lines);
  // };

  let top, bottom, canvas, shortcutsPopover;
  if (mode === 'edit') {
    top = (
      <div style={{ margin: '0 auto', marginBottom: 16, marginLeft: 16 }}>
        <Form
          layout={'inline'}
          name='generateNftData'
          onFinish={generateNftData}
          onFinishFailed={onFinishFailed}
          labelAlign={'left'}
          style={{ justifyContent: 'center' }}
        >
          <Button
            style={{ marginRight: 8, width: '150px' }}
            loading={sending}
            type='primary'
            htmlType='submit'
            disabled={!canMint}
          >
            {sending ? 'Minting NFT' : 'Mint NFT'}
          </Button>
          {/* <Button onClick={getNft} type='primary'>
            Get NFT
          </Button> */}
        </Form>

        <div style={{ marginTop: 16 }}>
          <Tooltip title='save to local storage'>
            <Button
              disabled={
                canvasDisabled ||
                (drawingCanvas.current && !drawingCanvas.current.lines.length)
              }
              onClick={() => {
                saveDrawing(drawingCanvas.current, true);
              }}
            >
              <SaveOutlined /> {`${!drawingSaved ? 'SAVE *' : 'SAVED'}`}
            </Button>
          </Tooltip>
          <Button
            disabled={
              canvasDisabled ||
              (drawingCanvas.current && !drawingCanvas.current.lines.length)
            }
            onClick={() => {
              undo();
            }}
          >
            <UndoOutlined /> UNDO
          </Button>
          <Popconfirm
            title='Are you sure?'
            disabled={
              canvasDisabled ||
              (drawingCanvas.current && !drawingCanvas.current.lines.length)
            }
            onConfirm={() => {
              drawingCanvas.current.clear();
              setDrawing();
            }}
            okText='Yes'
            cancelText='No'
          >
            <Button
              disabled={
                canvasDisabled ||
                (drawingCanvas.current && !drawingCanvas.current.lines.length)
              }
            >
              <ClearOutlined /> CLEAR
            </Button>
          </Popconfirm>
          <Button
            disabled={
              canvasDisabled ||
              (drawingCanvas.current && !drawingCanvas.current.lines.length)
            }
            onClick={() => {
              if (
                canvasDisabled ||
                (drawingCanvas.current && !drawingCanvas.current.lines)
              )
                return;
              drawingCanvas.current.loadSaveData(
                drawingCanvas.current.getSaveData(),
                false
              ); //LZ.decompress(props.drawing), false)
              setCanvasDisabled(true);
            }}
          >
            <PlaySquareOutlined /> PLAY
          </Button>
        </div>
      </div>
    );

    shortcutsPopover = (
      <Table
        columns={[
          { title: 'Hotkey', dataIndex: 'shortcut' },
          { title: 'Action', dataIndex: 'action' },
        ]}
        dataSource={[
          { key: '1', shortcut: 'Ctrl+z', action: 'Undo' },
          { key: '2', shortcut: ']', action: 'Increase brush size by 1' },
          {
            key: '3',
            shortcut: 'Shift+]',
            action: 'Increase brush size by 10',
          },
          { key: '4', shortcut: '[', action: 'Decrease brush size by 1' },
          {
            key: '5',
            shortcut: 'Shift+[',
            action: 'Decrease brush size by 10',
          },
          {
            key: '6',
            shortcut: '> ',
            action: 'Increase current color opacity by 1%',
          },
          {
            key: '7',
            shortcut: 'Shift+> ',
            action: 'Increase current color opacity by 10%',
          },
          {
            key: '8',
            shortcut: '<',
            action: 'Decrease current color opacity by 1%',
          },
          {
            key: '9',
            shortcut: 'Shift+< ',
            action: 'Decrease current color opacity by 10%',
          },
        ]}
        size='small'
        pagination={false}
      />
    );

    bottom = (
      <>
        <Row
          style={{
            margin: '0 auto',
            marginTop: '4vh',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'middle',
          }}
        >
          <Space>
            <PickerDisplay color={color} onChangeComplete={updateColor} />
            <Button
              onClick={() => {
                setPicker(picker + 1);
              }}
            >
              <HighlightOutlined />
            </Button>
          </Space>
        </Row>
        <Row
          style={{
            margin: '0 auto',
            marginTop: '4vh',
            justifyContent: 'center',
            alignItems: 'middle',
          }}
        >
          <AlphaPicker onChangeComplete={updateColor} color={color} />
        </Row>
        <Row
          style={{
            margin: '0 auto',
            marginTop: '4vh',
            justifyContent: 'center',
          }}
        >
          <Col span={12}>
            <Slider
              min={1}
              max={100}
              onChange={updateBrushRadius}
              value={typeof brushRadius === 'number' ? brushRadius : 0}
            />
          </Col>
          <Col span={4}>
            <InputNumber
              min={1}
              max={100}
              style={{ margin: '0 16px' }}
              value={brushRadius}
              onChange={updateBrushRadius}
            />
          </Col>
        </Row>
        <Row
          style={{
            margin: '0 auto',
            marginTop: '4vh',
            justifyContent: 'center',
          }}
        >
          {/* <Space>
            <Col span={4}>
              <Button onClick={() => fillBackground(color)}>
                <BgColorsOutlined />
                Background
              </Button>
            </Col>
            <Col span={4}>
              <Button onClick={() => drawFrame(color, brushRadius)}>
                <BorderOutlined />
                Frame
              </Button>
            </Col>
          </Space> */}
        </Row>
        <Row
          style={{
            justifyContent: 'center',
          }}
        >
          <Col>
            <Popover
              content={shortcutsPopover}
              title='Keyboard shortcuts'
              trigger='click'
            >
              <Button>
                <InfoCircleOutlined />
                Keyboard Shortcuts
              </Button>
            </Popover>
          </Col>
        </Row>
      </>
    );

    const saveCanvas = () => {
      if (canvasDisabled) {
        console.log('Canvas disabled');
      } else {
        console.log('saving canvas');
        saveDrawing(drawingCanvas.current, false);
      }
    };

    canvas = (
      <div
        style={{
          // backgroundColor: '#666666',
          // width: size[0],
          // margin: 'auto',
          // border: '1px solid #999999',
          boxShadow: '2px 2px 8px #AAAAAA',
          cursor: 'pointer',
        }}
        onMouseUp={saveCanvas}
        onTouchEnd={saveCanvas}
      >
        {!loaded && <span>Loading...</span>}
        <CanvasDraw
          key={mode + 'asd'}
          ref={drawingCanvas}
          // canvasWidth={size[0]}
          // canvasHeight={size[1]}
          brushColor={color}
          lazyRadius={1}
          brushRadius={brushRadius}
          disabled={canvasDisabled}
          hideGrid={true}
          //  hideGrid={props.mode !== "edit"}
          //  hideInterface={props.mode !== "edit"}
          onChange={() => {
            drawnLines.current = drawingCanvas.current.lines;
            if (
              drawnLines.current.length >= currentLines.current.length &&
              canvasDisabled
            ) {
              console.log('enabling it!');
              setCanvasDisabled(false);
            }
          }}
          saveData={initialDrawing}
          immediateLoading={true} //drawingSize >= 10000}
          loadTimeOffset={3}
        />
      </div>
    );
  }

  return (
    <div id='here' className='create-ink-container'>
      {
        <>
          {portrait && <div className='title-top'>{top}</div>}
          <div className='canvas'>{canvas}</div>
          {portrait ? (
            <div className='edit-tools-bottom'>{bottom}</div>
          ) : (
            <div>
              {top}
              <div className='edit-tools-side'>{bottom}</div>
            </div>
          )}
        </>
      }
    </div>
  );
}
