import debugModule from "debug";
const debug = debugModule("codec:decode:special");

import * as EvmUtils from "@truffle/codec/utils/evm";
import { Types, Values } from "@truffle/codec/format";
import decodeValue from "./value";
import * as Compiler from "@truffle/codec/compiler/types";
import * as Pointer from "@truffle/codec/pointer/types";
import * as Decoding from "./types";
import * as Evm from "@truffle/codec/evm";
import { solidityFamily } from "@truffle/codec/utils/compiler";

export default function* decodeSpecial(dataType: Types.Type, pointer: Pointer.SpecialPointer, info: Evm.Types.EvmInfo): Generator<Decoding.DecoderRequest, Values.Result, Uint8Array> {
  if(dataType.typeClass === "magic") {
    return yield* decodeMagic(dataType, pointer, info);
  }
  else {
    return yield* decodeValue(dataType, pointer, info);
  }
}

export function* decodeMagic(dataType: Types.MagicType, pointer: Pointer.SpecialPointer, info: Evm.Types.EvmInfo): Generator<Decoding.DecoderRequest, Values.MagicResult, Uint8Array> {

  let {state} = info;

  switch(pointer.special) {
    case "msg":
      return {
        type: dataType,
        kind: "value" as const,
        value: {
          data: yield* decodeValue(
            {
              typeClass: "bytes" as const,
              kind: "dynamic" as const,
              location: "calldata" as const
            },
            {
              location: "calldata" as const,
              start: 0,
              length: state.calldata.length
            },
            info
          ),
          sig: yield* decodeValue(
            {
              typeClass: "bytes" as const,
              kind: "static" as const,
              length: EvmUtils.SELECTOR_SIZE
            },
            {
              location: "calldata" as const,
              start: 0,
              length: EvmUtils.SELECTOR_SIZE,
            },
            info
          ),
          sender: yield* decodeValue(
	    senderType(info.currentContext.compiler),
            {location: "special" as const, special: "sender" },
            info
          ),
          value: yield* decodeValue(
            {
              typeClass: "uint",
              bits: 256
            },
            {location: "special" as const, special: "value" },
            info
          )
        }
      };
    case "tx":
      return {
        type: dataType,
        kind: "value" as const,
        value: {
          origin: yield* decodeValue(
	    externalAddressType(info.currentContext.compiler),
            {location: "special" as const, special: "origin"},
            info
          ),
          gasprice: yield* decodeValue(
            {
              typeClass: "uint" as const,
              bits: 256
            },
            {location: "special" as const, special: "gasprice"},
            info
          )
        }
      };
    case "block":
      let block: {[field: string]: Values.Result} = {
        coinbase: yield* decodeValue(
	  externalAddressType(info.currentContext.compiler),
          {location: "special" as const, special: "coinbase"},
          info
        )
      };
      //the other ones are all uint's, so let's handle them all at once; due to
      //the lack of generator arrow functions, we do it by mutating block
      const variables = ["difficulty", "gaslimit", "number", "timestamp"];
      for (let variable of variables) {
        block[variable] = yield* decodeValue(
          {
            typeClass: "uint" as const,
            bits: 256
          },
          {location: "special" as const, special: variable},
          info
        );
      }
      return {
        type: dataType,
        kind: "value" as const,
        value: block
      };
  }
}

//NOTE: this is going to change again in 0.6.x!  be ready!
function senderType(compiler: Compiler.CompilerVersion): Types.AddressType {
  switch(solidityFamily(compiler)) {
    case "pre-0.5.0":
      return {
	typeClass: "address",
	kind: "general"
      }
    case "0.5.x":
      return {
	typeClass: "address",
	kind: "specific",
	payable: true
      }
  }
}

function externalAddressType(compiler: Compiler.CompilerVersion): Types.AddressType {
  switch(solidityFamily(compiler)) {
    case "pre-0.5.0":
      return {
	typeClass: "address",
	kind: "general"
      }
    case "0.5.x":
      return {
	typeClass: "address",
	kind: "specific",
	payable: true
      }
  }
}
