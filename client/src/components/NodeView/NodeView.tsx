import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { FrontendAnchorGateway } from '../../anchors'
import { generateObjectId } from '../../global'
import {
  alertMessageState,
  alertOpenState,
  alertTitleState,
  currentNodeState,
  endAnchorState,
  isLinkingState,
  refreshLinkListState,
  selectedAnchorsState,
  selectedExtentState,
  startAnchorState,
} from '../../global/Atoms'
import { IAnchor, INode, isSameExtent, NodeIdsToNodesMap } from '../../types'
import { NodeBreadcrumb } from './NodeBreadcrumb'
import { NodeContent } from './NodeContent'
import { NodeHeader } from './NodeHeader'
import { NodeLinkMenu } from './NodeLinkMenu'
import './NodeView.scss'

export interface INodeViewProps {
  currentNode: INode
  // map of nodeIds to nodes
  nodeIdsToNodesMap: NodeIdsToNodesMap
  // handler for completing link
  onCompleteLinkClick: () => void
  // handler for opening create node modal
  onCreateNodeButtonClick: () => void
  // handler for deleting currentNode
  onDeleteButtonClick: (node: INode) => void
  // handler for opening move node modal
  onMoveButtonClick: (node: INode) => void
  // handler for opening graph view
  onOpenGraphClick: () => void
  // handler for writing review
  onReviewButtonClick: () => void
  // children used when rendering folder node
  childNodes?: INode[]
}

/** Full page view focused on a node's content, with annotations and links */
export const NodeView = (props: INodeViewProps) => {
  const {
    currentNode,
    nodeIdsToNodesMap,
    onCompleteLinkClick,
    onCreateNodeButtonClick,
    onDeleteButtonClick,
    onMoveButtonClick,
    onOpenGraphClick,
    onReviewButtonClick,
    childNodes,
  } = props
  const setIsLinking = useSetRecoilState(isLinkingState)
  const [startAnchor, setStartAnchor] = useRecoilState(startAnchorState)
  const setEndAnchor = useSetRecoilState(endAnchorState)
  const setSelectedAnchors = useSetRecoilState(selectedAnchorsState)
  const selectedExtent = useRecoilValue(selectedExtentState)
  const refreshLinkList = useRecoilValue(refreshLinkListState)
  const [anchors, setAnchors] = useState<IAnchor[]>([])
  const setAlertIsOpen = useSetRecoilState(alertOpenState)
  const setAlertTitle = useSetRecoilState(alertTitleState)
  const setAlertMessage = useSetRecoilState(alertMessageState)
  const setCurrentNode = useSetRecoilState(currentNodeState)
  const {
    filePath: { path },
  } = currentNode

  useEffect(() => {
    setCurrentNode(currentNode)
  })

  const loadAnchorsFromNodeId = useCallback(async () => {
    const anchorsFromNode = await FrontendAnchorGateway.getAnchorsByNodeId(
      currentNode.nodeId
    )
    if (anchorsFromNode.success && anchorsFromNode.payload) {
      setAnchors(anchorsFromNode.payload)
    }
  }, [currentNode])

  const handleStartLinkClick = () => {
    if (selectedExtent === undefined) {
      setAlertIsOpen(true)
      setAlertTitle('Cannot start link from this anchor')
      setAlertMessage(
        `There are overlapping anchors, or this anchor contains other anchors.
        Before you create this anchor you must remove the other anchors.`
      )
    } else {
      const anchor = {
        anchorId: generateObjectId('anchor'),
        extent: selectedExtent,
        nodeId: currentNode.nodeId,
      }
      setStartAnchor(anchor)
      setIsLinking(true)
    }
  }

  const handleCompleteLinkClick = async () => {
    const anchorsByNodeResp = await FrontendAnchorGateway.getAnchorsByNodeId(
      currentNode.nodeId
    )
    let anchor2: IAnchor | undefined = undefined
    if (
      anchorsByNodeResp.success &&
      anchorsByNodeResp.payload &&
      selectedExtent !== undefined
    ) {
      anchorsByNodeResp.payload?.forEach((nodeAnchor) => {
        if (isSameExtent(nodeAnchor.extent, selectedExtent)) {
          anchor2 = nodeAnchor
        }
        if (
          startAnchor &&
          isSameExtent(nodeAnchor.extent, startAnchor.extent) &&
          startAnchor.nodeId == currentNode.nodeId
        ) {
          setStartAnchor(nodeAnchor)
        }
      })
    }
    if (selectedExtent !== undefined) {
      anchor2 = {
        anchorId: generateObjectId('anchor'),
        extent: selectedExtent,
        nodeId: currentNode.nodeId,
      }
      setEndAnchor(anchor2)
      onCompleteLinkClick()
    }
  }

  useEffect(() => {
    setSelectedAnchors([])
    loadAnchorsFromNodeId()
  }, [loadAnchorsFromNodeId, currentNode, refreshLinkList, setSelectedAnchors])

  const hasBreadcrumb: boolean = path.length > 1
  const hasAnchors: boolean = anchors.length > 0
  let nodePropertiesWidth: number = hasAnchors ? 200 : 0
  const nodeViewWidth: string = `calc(100% - ${nodePropertiesWidth}px)`

  const nodeProperties = useRef<HTMLHeadingElement>(null)
  const divider = useRef<HTMLHeadingElement>(null)
  let xLast: number
  let dragging: boolean = false

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging = true
    xLast = e.screenX
    document.removeEventListener('pointermove', onPointerMove)
    document.addEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.addEventListener('pointerup', onPointerUp)
  }

  const onPointerMove = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (divider.current) divider.current.style.width = '10px'
    if (nodeProperties.current && dragging) {
      const nodePropertiesElement = nodeProperties.current
      let width = parseFloat(nodePropertiesElement.style.width)
      const deltaX = e.screenX - xLast // The change in the x location
      const newWidth = (width -= deltaX)
      if (!(newWidth < 200 || newWidth > 480)) {
        nodePropertiesElement.style.width = String(width) + 'px'
        nodePropertiesWidth = width
        xLast = e.screenX
      }
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging = false
    if (divider.current) divider.current.style.width = ''
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }

  return (
    <div className="node">
      <div className="nodeView" style={{ width: nodeViewWidth }}>
        <NodeHeader
          onCreateNodeButtonClick={onCreateNodeButtonClick}
          onDeleteButtonClick={onDeleteButtonClick}
          onMoveButtonClick={onMoveButtonClick}
          onHandleStartLinkClick={handleStartLinkClick}
          onHandleCompleteLinkClick={handleCompleteLinkClick}
          onOpenGraphClick={onOpenGraphClick}
          onReviewButtonClick={onReviewButtonClick}
        />
        <div className="nodeView-scrollable">
          {hasBreadcrumb && (
            <div className="nodeView-breadcrumb">
              <NodeBreadcrumb path={path} nodeIdsToNodesMap={nodeIdsToNodesMap} />
            </div>
          )}
          <div className="nodeView-content">
            <NodeContent
              childNodes={childNodes}
              onCreateNodeButtonClick={onCreateNodeButtonClick}
            />
          </div>
        </div>
      </div>
      {hasAnchors && (
        <div className="divider" ref={divider} onPointerDown={onPointerDown} />
      )}
      {hasAnchors && (
        <div
          className={'nodeProperties'}
          ref={nodeProperties}
          style={{ width: nodePropertiesWidth }}
        >
          <NodeLinkMenu nodeIdsToNodesMap={nodeIdsToNodesMap} />
        </div>
      )}
    </div>
  )
}
